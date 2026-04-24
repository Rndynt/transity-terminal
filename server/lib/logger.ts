/**
 * S3-04: structured logging dengan pino.
 *
 * Tujuan:
 *  - JSON output di production (mudah parsing oleh log shipper / Loki).
 *  - Pretty output di development (lebih mudah dibaca manusia, kalau
 *    pino-pretty tersedia — fallback ke JSON kalau tidak).
 *  - Child logger per-modul: `logger.child({ mod: 'webhook' })`.
 *  - Redact field sensitif default (auth header, password, secret).
 *
 * Kontrak penggunaan:
 *  ```ts
 *  import { childLogger } from '../lib/logger';
 *  const log = childLogger('refunds');
 *  log.info({ refundId, bookingId }, 'refund approved');
 *  log.error({ err }, 'refund failed');
 *  ```
 *
 * Migrasi gradual: console.log/console.error existing TIDAK dihapus —
 * pino jadi additional surface untuk modul yang sudah kita migrate.
 * Modul yang belum di-migrate tetap pakai console (di-redirect oleh
 * pino transport di production kalau perlu, future work).
 */
import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');

const baseConfig: pino.LoggerOptions = {
  level,
  base: {
    service: 'transity-terminal',
    env: process.env.NODE_ENV || 'development',
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'password',
      'token',
      '*.password',
      '*.token',
      '*.secret',
      'req.headers.authorization',
      'req.headers["x-service-key"]',
      'req.headers.cookie',
      'serviceKey',
      'apiKey',
    ],
    censor: '[REDACTED]',
  },
};

// Pretty transport hanya di dev kalau modul tersedia. Pino import sub-
// module dinamis — kalau gagal (pino-pretty tidak terinstall) fallback ke
// JSON pretty di console.
let logger: pino.Logger;
if (!isProd) {
  try {
    logger = pino({
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss.l', singleLine: false },
      },
    });
  } catch {
    logger = pino(baseConfig);
  }
} else {
  logger = pino(baseConfig);
}

export { logger };

/**
 * Buat child logger dengan binding `mod` (modul). Membantu filter di
 * production (kibana/loki query: `service:transity-terminal AND mod:webhook`).
 */
export function childLogger(mod: string, extra: Record<string, unknown> = {}): pino.Logger {
  return logger.child({ mod, ...extra });
}
