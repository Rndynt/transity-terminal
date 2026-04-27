import pino, { type Logger } from "pino";

/**
 * Root pino logger untuk seluruh server.
 *
 * **Konfigurasi via env:**
 * - `LOG_LEVEL`: trace|debug|info|warn|error|fatal (default: "info" di prod, "debug" di dev)
 * - `LOG_PRETTY`: "true" untuk pretty-printed output (otomatis di dev kalau pino-pretty terinstall)
 *
 * **Pemakaian:**
 * - File modul/service tanpa req-context: `import { logger } from "../lib/logger"; logger.info({...}, "msg")`
 * - Route handlers: `req.log.info({...}, "msg")` (Fastify auto-inject child logger dengan request_id)
 * - Buat child logger dengan binding tetap: `const log = logger.child({ component: "scheduler" })`
 *
 * **Format structured fields:**
 * - Selalu pisahkan data dari pesan: `logger.info({ tripId, count }, "trip materialized")`
 * - JANGAN string-concatenate values ke message: `logger.info("trip " + tripId)` ❌
 */
const isProduction = process.env.NODE_ENV === "production";
const defaultLevel = isProduction ? "info" : "debug";

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL || defaultLevel,
  // Hindari leak PID/hostname ke log production (privacy + size)
  base: isProduction ? undefined : { pid: process.pid },
  formatters: {
    level: (label) => ({ level: label }),
  },
  // pino auto-pretty kalau pino-pretty terinstall + LOG_PRETTY=true atau bukan production
  transport:
    !isProduction && process.env.LOG_PRETTY !== "false"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
            translateTime: "HH:MM:ss.l",
          },
        }
      : undefined,
});

/**
 * Helper untuk membuat child logger dengan component binding. Membantu trace
 * log per-modul tanpa harus repeat `{ component }` di setiap call.
 *
 * Pemakaian:
 * ```
 * const log = createComponentLogger("scheduler");
 * log.info({ tripId }, "materialized");
 * // -> { level: "info", component: "scheduler", tripId: "...", msg: "materialized" }
 * ```
 */
export function createComponentLogger(component: string): Logger {
  return logger.child({ component });
}
