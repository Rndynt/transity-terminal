import IORedis, { type Redis, type RedisOptions } from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Adapter } from 'socket.io-adapter';
import { createComponentLogger } from '../lib/logger';

const log = createComponentLogger('redis');

export function getRedisUrl(): string | null {
  const raw = process.env.REDIS_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'redis:' && u.protocol !== 'rediss:') {
      log.warn({ protocol: u.protocol }, 'REDIS_URL has unsupported protocol; use redis:// or rediss://. Falling back to in-memory.');
      return null;
    }
    if (!u.hostname) {
      log.warn('REDIS_URL is missing a hostname. Falling back to in-memory.');
      return null;
    }
    return raw;
  } catch {
    log.warn('REDIS_URL is not a valid URL. Expected format: redis://[user:pass@]host:port[/db]. Falling back to in-memory.');
    return null;
  }
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
    log.error({ role, err }, 'redis client error');
  });
  client.on('reconnecting', (delay: number) => {
    log.warn({ role, delayMs: delay }, 'redis reconnecting');
  });
  client.on('ready', () => {
    log.info({ role }, 'redis ready');
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
    log.error({ role: 'sio-sub', err }, 'redis sub client error');
  });
  try {
    await Promise.all([
      pubClient.status === 'ready' ? Promise.resolve() : new Promise<void>((res) => pubClient.once('ready', () => res())),
      subClient.status === 'ready' ? Promise.resolve() : new Promise<void>((res) => subClient.once('ready', () => res())),
    ]);
  } catch (err) {
    log.error({ err }, 'socket.io failed to ready redis clients');
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
