import IORedis, { type Redis, type RedisOptions } from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Adapter } from 'socket.io-adapter';

export function getRedisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim();
  return url && url.length > 0 ? url : null;
}

export function isRedisEnabled(): boolean {
  return getRedisUrl() !== null;
}

function buildClient(url: string, role: string, opts: Partial<RedisOptions> = {}): Redis {
  const useTls = url.startsWith('rediss://');
  const client = new IORedis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: opts.maxRetriesPerRequest ?? 3,
    enableReadyCheck: true,
    enableOfflineQueue: opts.enableOfflineQueue ?? true,
    connectionName: `transity-${role}`,
    ...(useTls ? { tls: { rejectUnauthorized: false } } : {}),
    ...opts,
  });
  client.on('error', (err) => {
    console.error(`[redis:${role}] error: ${err?.message || err}`);
  });
  client.on('reconnecting', (delay: number) => {
    console.warn(`[redis:${role}] reconnecting in ${delay}ms`);
  });
  client.on('ready', () => {
    console.log(`[redis:${role}] ready`);
  });
  return client;
}

export type SocketIoAdapterBundle = {
  adapter: (nsp: unknown) => Adapter;
  pubClient: Redis;
  subClient: Redis;
};

export async function createSocketIoAdapter(): Promise<SocketIoAdapterBundle | null> {
  const url = getRedisUrl();
  if (!url) return null;
  const pubClient = buildClient(url, 'sio-pub');
  const subClient = pubClient.duplicate();
  subClient.on('error', (err) => {
    console.error(`[redis:sio-sub] error: ${err?.message || err}`);
  });
  try {
    await Promise.all([
      pubClient.status === 'ready' ? Promise.resolve() : new Promise<void>((res) => pubClient.once('ready', () => res())),
      subClient.status === 'ready' ? Promise.resolve() : new Promise<void>((res) => subClient.once('ready', () => res())),
    ]);
  } catch (err) {
    console.error('[redis:socket.io] failed to ready clients:', err);
    pubClient.disconnect();
    subClient.disconnect();
    return null;
  }
  const adapter = createAdapter(pubClient, subClient) as unknown as (nsp: unknown) => Adapter;
  return { adapter, pubClient, subClient };
}

export function createRateLimitRedisClient(): Redis | null {
  const url = getRedisUrl();
  if (!url) return null;
  return buildClient(url, 'rate-limit', {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });
}
