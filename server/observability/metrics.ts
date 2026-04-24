/**
 * S3-05: Prometheus metrics emitter untuk TransityTerminal.
 *
 * Endpoint `/api/metrics` (gated by TERMINAL_SERVICE_KEY) expose semua
 * metric format Prometheus text. Kontrak metric mengikuti
 * `docs/terminal-readiness/grafana/transity-dashboard.json`:
 *
 *   1. transity_http_requests_total{status_class}  (counter, by 1/2/3/4/5xx)
 *   2. transity_http_request_duration_ms (histogram, buckets 5..2000ms)
 *   3. transity_booking_total{stage} (counter: hold|pay_init|confirmed|cancelled)
 *   4. transity_compensation_queue_size{status} (gauge: pending|dead_lettered)
 *   5. transity_engine_request_duration_ms{op} (histogram)
 *   6. transity_ws_connected_clients (gauge)
 *   7. transity_db_pool_active|idle|waiting (gauge)
 *   8. transity_refund_total{status} (counter)
 *   9. transity_webhook_total{kind} (counter: processed|replay_idempotent|hmac_fail)
 *  10. transity_health_subsystem_ok{subsystem} (gauge: 0/1, by db|engine|redis|realmio)
 *
 * Default Node.js metrics (process_resident_memory_bytes, eventloop lag, dll)
 * ikut auto-collected oleh prom-client.collectDefaultMetrics.
 */
import client from 'prom-client';

export const register = new client.Registry();

// Auto-collect Node.js process metrics (memory, eventloop, gc, dll).
client.collectDefaultMetrics({
  register,
  prefix: 'transity_node_',
});

// 1. HTTP requests total
export const httpRequestsTotal = new client.Counter({
  name: 'transity_http_requests_total',
  help: 'Total HTTP requests, classified by status class (1xx/2xx/3xx/4xx/5xx) and method',
  labelNames: ['method', 'status_class'] as const,
  registers: [register],
});

// 2. HTTP request duration (histogram)
export const httpRequestDurationMs = new client.Histogram({
  name: 'transity_http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
  labelNames: ['method', 'route'] as const,
  registers: [register],
});

// 3. Booking funnel
export const bookingTotal = new client.Counter({
  name: 'transity_booking_total',
  help: 'Booking lifecycle stages',
  labelNames: ['stage'] as const, // hold | pay_init | confirmed | cancelled
  registers: [register],
});

// 4. Compensation queue size
export const compensationQueueSize = new client.Gauge({
  name: 'transity_compensation_queue_size',
  help: 'Engine compensation queue current size by status',
  labelNames: ['status'] as const, // pending | dead_lettered
  registers: [register],
});

// 5. Engine request duration
export const engineRequestDurationMs = new client.Histogram({
  name: 'transity_engine_request_duration_ms',
  help: 'Reservation engine request duration ms',
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000],
  labelNames: ['op'] as const, // hold | confirm | cancel | reschedule | health
  registers: [register],
});

// 6. WS connected clients
export const wsConnectedClients = new client.Gauge({
  name: 'transity_ws_connected_clients',
  help: 'Currently connected WebSocket clients',
  registers: [register],
});

// 7. DB pool gauges
export const dbPoolActive = new client.Gauge({
  name: 'transity_db_pool_active',
  help: 'Active DB connections in pool',
  registers: [register],
});
export const dbPoolIdle = new client.Gauge({
  name: 'transity_db_pool_idle',
  help: 'Idle DB connections in pool',
  registers: [register],
});
export const dbPoolWaiting = new client.Gauge({
  name: 'transity_db_pool_waiting',
  help: 'Clients waiting for DB connection',
  registers: [register],
});

// 8. Refund total
export const refundTotal = new client.Counter({
  name: 'transity_refund_total',
  help: 'Refund operations by status',
  labelNames: ['status'] as const, // requested | approved | rejected | failed
  registers: [register],
});

// 9. Webhook total
export const webhookTotal = new client.Counter({
  name: 'transity_webhook_total',
  help: 'Payment webhook events by kind',
  labelNames: ['kind'] as const, // processed | replay_idempotent | hmac_fail
  registers: [register],
});

// 10. Health subsystem status
export const healthSubsystemOk = new client.Gauge({
  name: 'transity_health_subsystem_ok',
  help: 'Last health check status per subsystem (1=ok, 0=fail)',
  labelNames: ['subsystem'] as const,
  registers: [register],
});

/**
 * Helper: refresh DB pool gauges dari pg.Pool. Dipanggil periodic
 * (scheduler atau on /metrics scrape via getMetrics wrapper).
 */
export async function refreshDbPoolMetrics(): Promise<void> {
  try {
    const { pool } = await import('../db');
    // pg.Pool exposes totalCount, idleCount, waitingCount
    const p = pool as unknown as { totalCount: number; idleCount: number; waitingCount: number };
    dbPoolActive.set(Math.max(0, (p.totalCount ?? 0) - (p.idleCount ?? 0)));
    dbPoolIdle.set(p.idleCount ?? 0);
    dbPoolWaiting.set(p.waitingCount ?? 0);
  } catch {
    // pool tidak tersedia — biarkan gauge di nilai sebelumnya
  }
}

/**
 * Helper: refresh compensation queue size gauge dari DB. Schema pakai
 * deadLetteredAt timestamp (NULL = pending, NOT NULL = dead-lettered).
 * Dipanggil pada /metrics scrape supaya gauge selalu fresh tanpa
 * scheduler tambahan.
 */
export async function refreshCompensationQueueMetrics(): Promise<void> {
  try {
    const { db } = await import('../db');
    const { engineCompensationQueue } = await import('@shared/schema');
    const { sql } = await import('drizzle-orm');
    const rows = await db
      .select({
        bucket: sql<string>`CASE WHEN ${engineCompensationQueue.deadLetteredAt} IS NULL THEN 'pending' ELSE 'dead_lettered' END`,
        count: sql<number>`count(*)::int`,
      })
      .from(engineCompensationQueue)
      .groupBy(sql`1`);
    // Reset both buckets ke 0 dulu supaya kalau salah satu bucket kosong,
    // gauge tidak stuck di nilai lama.
    compensationQueueSize.set({ status: 'pending' }, 0);
    compensationQueueSize.set({ status: 'dead_lettered' }, 0);
    for (const r of rows) {
      compensationQueueSize.set({ status: r.bucket }, Number(r.count ?? 0));
    }
  } catch {
    // DB tidak tersedia — biarkan gauge di nilai sebelumnya
  }
}

/**
 * WS gauge helper: dipanggil dari realtime/ws.ts pada connect/disconnect
 * supaya transity_ws_connected_clients akurat tanpa polling.
 */
export function incWsClient(): void { wsConnectedClients.inc(); }
export function decWsClient(): void { wsConnectedClients.dec(); }

/**
 * Hook helper supaya http counters tercatat per request. Dipasang di
 * registerRoutes lewat onResponse hook.
 */
export function recordHttpResponse(method: string, statusCode: number, route: string, durationMs: number): void {
  const sc = `${Math.floor(statusCode / 100)}`;
  httpRequestsTotal.inc({ method, status_class: sc });
  httpRequestDurationMs.observe({ method, route }, durationMs);
}
