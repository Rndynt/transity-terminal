/**
 * Global Fastify error handler — single source of truth.
 *
 * Diekstrak dari `server/index.ts` supaya:
 *   1. Logika mapping error → HTTP status hanya hidup di satu tempat.
 *   2. Test integrasi (mis. `tests/integration/rbac-endpoint-403.test.ts`)
 *      bisa pasang handler yang SAMA dengan production tanpa
 *      meng-import `server/index.ts` (yang punya side effect boot:
 *      koneksi DB, migrasi, dll).
 *
 * Mapping yang dijaga:
 *   - 23505 (unique violation) → 409 dengan pesan ramah.
 *   - ZodError                 → 400 dengan ringkasan field.
 *   - err.status / err.statusCode → kode itu (incl. 403 dari
 *     `PermissionDeniedError` di `rbac.guard.ts`).
 *   - default                  → 500.
 *
 * 5xx + uncaught dilaporkan ke Sentry via `captureError`. 4xx tidak
 * (bukan alert-worthy).
 */
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { captureError } from "./observability/sentry";
import { createComponentLogger } from "./lib/logger";

const log = createComponentLogger("errorHandler");

export type AppError = Error & {
  status?: number;
  statusCode?: number;
  code?: string;
};

export function registerGlobalErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: AppError, request, reply) => {
    if (err.code === "23505") {
      const detail: string = (err as { detail?: string }).detail ?? "";
      const valueMatch = detail.match(/Key \([^)]+\)=\(([^)]+)\)/);
      const fieldMatch = detail.match(/Key \(([^)]+)\)=/);
      const value = valueMatch ? valueMatch[1] : null;
      const field = fieldMatch ? fieldMatch[1] : "data";
      const msg = value
        ? `Kode "${value}" sudah digunakan. Gunakan ${field} yang berbeda.`
        : `Nilai ${field} sudah digunakan. Gunakan nilai yang berbeda.`;
      return reply.code(409).send({ message: msg });
    }

    if (err instanceof ZodError) {
      const messages = err.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      return reply.code(400).send({ message: `Data tidak valid: ${messages}` });
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // S3-03: 5xx + uncaught → Sentry. 4xx adalah client error,
    // tidak perlu alert (akan polusi Sentry feed).
    if (status >= 500) {
      captureError(err, {
        mod: "fastify",
        op: request.method,
        tags: { route: request.url, code: err.code || "unknown" },
      });
    }

    reply.code(status).send({ message });
    if (status === 500) {
      log.error({ err, route: request.url, method: request.method }, "unhandled 500");
    }
  });
}
