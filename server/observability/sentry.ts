/**
 * S3-03: Sentry server-side instrumentation, gated on SENTRY_DSN.
 *
 * Tujuan:
 *  - Tidak ada side-effect kalau SENTRY_DSN belum diset (dev / fresh
 *    install) — `init()` cuma log ke console.
 *  - Aman dipanggil di awal boot sebelum Fastify (Sentry harus
 *    diinit lebih dulu untuk menangkap unhandled errors saat boot).
 *  - Helper `captureError(err, ctx)` dipakai modul kritis (webhook,
 *    refunds, compensation queue) supaya error penting di-tag dan
 *    di-search di Sentry UI.
 *  - `expressErrorHandler`-like wrapper: kita Fastify, jadi pakai
 *    `app.setErrorHandler` di server/index.ts untuk forward error.
 *
 * Source map upload: ditangani di CI (S3-01) — `npm run build` +
 * `sentry-cli sourcemaps upload` step (lihat docs/terminal-readiness/
 * RUNBOOK-SENTRY-SETUP.md untuk DSN provisioning + CI secret).
 */
import * as Sentry from '@sentry/node';
import { createComponentLogger } from '../lib/logger';

const log = createComponentLogger('sentry');
let initialized = false;

export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    log.info('SENTRY_DSN not set — sentry disabled');
    return false;
  }
  if (initialized) return true;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || process.env.GIT_SHA || undefined,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.05'),
    // Server-side: tangkap unhandled rejection + uncaught exception
    // otomatis (default integration). Kita tidak include integration
    // HTTP Express karena kita pakai Fastify — capture manual via
    // setErrorHandler.
  });

  initialized = true;
  log.info({ env: process.env.NODE_ENV || 'development' }, 'sentry initialized');
  return true;
}

/**
 * Capture error dengan context tag. Aman dipanggil meski Sentry belum
 * di-init (no-op).
 */
export function captureError(
  err: unknown,
  ctx?: { mod?: string; op?: string; bookingId?: string; refundId?: string; tags?: Record<string, string>; extra?: Record<string, unknown> }
): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (ctx?.mod) scope.setTag('mod', ctx.mod);
    if (ctx?.op) scope.setTag('op', ctx.op);
    if (ctx?.bookingId) scope.setTag('bookingId', ctx.bookingId);
    if (ctx?.refundId) scope.setTag('refundId', ctx.refundId);
    if (ctx?.tags) {
      for (const [k, v] of Object.entries(ctx.tags)) scope.setTag(k, v);
    }
    if (ctx?.extra) {
      for (const [k, v] of Object.entries(ctx.extra)) scope.setExtra(k, v);
    }
    Sentry.captureException(err);
  });
}

/**
 * Capture warning message (non-error event). Berguna untuk DLQ trigger,
 * compensation queue stuck, dll yg perlu visibility tapi bukan error.
 */
export function captureMessage(
  msg: string,
  level: 'warning' | 'error' | 'info' = 'warning',
  ctx?: { mod?: string; tags?: Record<string, string>; extra?: Record<string, unknown> }
): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (ctx?.mod) scope.setTag('mod', ctx.mod);
    if (ctx?.tags) {
      for (const [k, v] of Object.entries(ctx.tags)) scope.setTag(k, v);
    }
    if (ctx?.extra) {
      for (const [k, v] of Object.entries(ctx.extra)) scope.setExtra(k, v);
    }
    Sentry.captureMessage(msg, level);
  });
}

/** Flush Sentry buffer sebelum process exit (SIGTERM handler). */
export async function flushSentry(timeoutMs = 2000): Promise<boolean> {
  if (!initialized) return true;
  try {
    return await Sentry.flush(timeoutMs);
  } catch {
    return false;
  }
}
