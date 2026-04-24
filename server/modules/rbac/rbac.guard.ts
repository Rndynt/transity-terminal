/**
 * S1-09 (delivered in Sprint 2): service-layer permission guards.
 *
 * Sebelumnya pemeriksaan RBAC hanya dilakukan di route handler via
 * `requireFlag()` (lihat rbac.middleware.ts). Kalau ada caller lain yang
 * memanggil service kelas langsung — misal job scheduler, websocket
 * handler, atau modul internal yang me-reuse `*.service.ts` — guard di
 * route ke-skip dan staf bisa melakukan operasi yang seharusnya ditolak.
 *
 * Pola baru:
 *   - Setiap method service yang sensitif menerima `ctx: ServiceContext`
 *     sebagai argumen terakhir.
 *   - Method memanggil `requirePermission(ctx, 'master.drivers')` di
 *     awal. Kalau ctx tidak punya flag tersebut → throw
 *     `PermissionDeniedError` (status 403, ditangkap oleh Fastify
 *     errorHandler dan dikirim ke klien apa adanya).
 *   - Controller menggunakan `buildServiceContext(req)` untuk merubah
 *     `req.rbac` + `req.user` jadi `ServiceContext`.
 *   - Caller internal yang bukan staf (mis. customer-app booking flow,
 *     test utility) memakai `SYSTEM_CONTEXT` secara eksplisit supaya
 *     reviewer langsung sadar bahwa pengecualian dipakai.
 */

import type { FastifyRequest } from "fastify";
import type { EffectivePermissions } from "./rbac.service";

export interface ServiceContext {
  /** Flag aktif (lihat rbac.service.FALLBACK_FLAGS). */
  flags: Set<string>;
  /** Outlet scope user (null = semua outlet, biasanya owner/finance). */
  outletId: string | null;
  /** Role label untuk audit/log (owner, manager, cso, …). */
  roleId: string | null;
  /** User identifier untuk audit trail. */
  userId: string | null;
  /** Email/username untuk audit trail. */
  userEmail: string | null;
  /**
   * `true` kalau context dibuat lewat `SYSTEM_CONTEXT`. Guard akan tetap
   * memeriksa flag — system context memberikan semua flag, jadi otomatis
   * lolos. Field ini cuma untuk logging supaya kita tahu sebuah operasi
   * dipicu oleh modul internal, bukan oleh klik staf.
   */
  isSystem?: boolean;
}

export class PermissionDeniedError extends Error {
  /** Fastify errorHandler memetakan ini ke HTTP 403. */
  readonly statusCode = 403;
  readonly status = 403;
  readonly requiredFlags: string[];
  readonly mode: "all" | "any";

  constructor(requiredFlags: string[], mode: "all" | "any" = "all") {
    const list = requiredFlags.join(", ");
    super(
      mode === "any"
        ? `Akses ditolak. Salah satu izin berikut dibutuhkan: ${list}.`
        : `Akses ditolak. Izin '${list}' dibutuhkan.`,
    );
    this.name = "PermissionDeniedError";
    this.requiredFlags = requiredFlags;
    this.mode = mode;
  }
}

function ensureContext(ctx: ServiceContext | null | undefined, perm: string): asserts ctx is ServiceContext {
  if (!ctx) {
    // Tidak ada konteks user sama sekali — ini caller yang lupa pasang
    // ctx, bukan staf yang kekurangan izin. Tetap 403 supaya operasi
    // gagal aman, tapi pesannya membantu developer.
    throw new PermissionDeniedError([perm]);
  }
  if (!(ctx.flags instanceof Set)) {
    throw new PermissionDeniedError([perm]);
  }
}

/**
 * Lempar `PermissionDeniedError` kalau ctx tidak punya flag `perm`.
 * Penggunaan: panggil di awal setiap method service yang sensitif.
 */
export function requirePermission(
  ctx: ServiceContext | null | undefined,
  perm: string,
): asserts ctx is ServiceContext {
  ensureContext(ctx, perm);
  if (!ctx.flags.has(perm)) {
    throw new PermissionDeniedError([perm]);
  }
}

/**
 * Lolos kalau ctx punya minimal satu dari `perms`. Berguna kalau aksi
 * boleh dilakukan oleh beberapa role yang berbeda (mis. owner ATAU
 * manager).
 */
export function requireAnyPermission(
  ctx: ServiceContext | null | undefined,
  ...perms: string[]
): asserts ctx is ServiceContext {
  if (perms.length === 0) return;
  if (!ctx) throw new PermissionDeniedError(perms, "any");
  if (!(ctx.flags instanceof Set)) throw new PermissionDeniedError(perms, "any");
  if (!perms.some((p) => ctx.flags.has(p))) {
    throw new PermissionDeniedError(perms, "any");
  }
}

/**
 * Buat `ServiceContext` dari sebuah request HTTP. Aman dipanggil bahkan
 * kalau `req.rbac` belum di-attach (mis. route public tanpa requireAuth)
 * — hasilnya context kosong dan setiap `requirePermission` akan menolak.
 */
export function buildServiceContext(req: FastifyRequest): ServiceContext {
  const rbac: EffectivePermissions | undefined = req.rbac;
  const user = (req as any).user as { id?: string; email?: string } | undefined;
  return {
    flags: rbac?.flags ?? new Set<string>(),
    outletId: rbac?.outletId ?? null,
    roleId: rbac?.roleId ?? null,
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
  };
}

/**
 * Sentinel context untuk caller internal yang BUKAN staf — misal:
 *   - Customer-app cargo booking lewat `app.service.createAppCargo`.
 *     Customer punya app-auth sendiri, bukan staff RBAC.
 *   - Job scheduler / cron / migration script.
 *   - Smoke-test / seed.
 *
 * Gunakan dengan eksplisit supaya code review jelas: setiap pemakaian
 * SYSTEM_CONTEXT adalah pengecualian sadar yang harus diaudit.
 */
export const SYSTEM_CONTEXT: ServiceContext = Object.freeze({
  flags: new Set<string>(["__system__"]),
  outletId: null,
  roleId: "__system__",
  userId: "__system__",
  userEmail: "__system__",
  isSystem: true,
});

// Patch: SYSTEM_CONTEXT.flags.has() harus selalu return true. Set di JS
// tidak bisa "wildcard" by default, jadi kita override has() pada
// instance Set khusus ini.
(SYSTEM_CONTEXT.flags as Set<string> & { has: (v: string) => boolean }).has =
  () => true;
