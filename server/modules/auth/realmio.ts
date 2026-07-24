import type { FastifyRequest, FastifyReply } from "fastify";
import { getEffectivePermissions } from "@modules/rbac/rbac.service";
import { createComponentLogger } from "@server/lib/logger";

const log = createComponentLogger("auth.realmio");

export interface RealmioUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string | null;
  createdAt: string;
}

const REALMIO_BASE_URL = process.env.REALMIO_BASE_URL || "";
const REALMIO_TENANT_ID = process.env.REALMIO_TENANT_ID || "transity";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const DEV_BYPASS_AUTH =
  process.env.DEV_BYPASS_AUTH === "true" || (!IS_PRODUCTION && !REALMIO_BASE_URL);

if (IS_PRODUCTION && !REALMIO_BASE_URL && !DEV_BYPASS_AUTH) {
  log.fatal("REALMIO_BASE_URL is required in production. Auth will reject all requests.");
}

if (DEV_BYPASS_AUTH) {
  log.info("bypass auth enabled — all requests use dev user");
}

const DEV_USER: RealmioUser = {
  id: "dev-user-001",
  email: "owner@transity.id",
  name: "Owner Admin",
  image: null,
  role: "owner",
  createdAt: new Date().toISOString(),
};

async function verifyWithRealmio(
  cookieHeader?: string,
  authHeader?: string
): Promise<RealmioUser | null> {
  if (!REALMIO_BASE_URL) return null;

  const headers: Record<string, string> = {
    "X-Tenant-Id": REALMIO_TENANT_ID,
  };

  if (cookieHeader) headers["Cookie"] = cookieHeader;
  if (authHeader) headers["Authorization"] = authHeader;

  try {
    const res = await fetch(`${REALMIO_BASE_URL}/me`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? data;
  } catch {
    return null;
  }
}

async function attachRbac(req: FastifyRequest): Promise<void> {
  if (!req.user) return;
  try {
    req.rbac = await getEffectivePermissions(req.user.id, req.user.role);
  } catch {
    req.rbac = { flags: new Set(), outletId: null, roleId: req.user.role ?? null };
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  if (DEV_BYPASS_AUTH) {
    req.user = DEV_USER;
    await attachRbac(req);
    return;
  }

  try {
    const user = await verifyWithRealmio(req.headers.cookie, req.headers.authorization);
    if (!user) {
      return reply.code(401).send({ message: "Unauthorized" });
    }
    req.user = user;
    await attachRbac(req);
  } catch {
    return reply.code(401).send({ message: "Unauthorized" });
  }
}

export interface RealmioCreateUserResult {
  userId: string;
  email: string;
  name: string;
}

export async function createRealmioUser(
  name: string,
  email: string,
  password: string,
  origin?: string | null,
): Promise<RealmioCreateUserResult> {
  if (!REALMIO_BASE_URL) {
    const fakeId = `dev-${Date.now()}`;
    return { userId: fakeId, email, name };
  }

  // Realmio requires an Origin header — fall back to the configured CORS origin
  // when the caller doesn't supply one (e.g. server-initiated account creation).
  const effectiveOrigin =
    origin ||
    (process.env.APP_CORS_ORIGINS ?? "").split(",")[0].trim() ||
    REALMIO_BASE_URL;

  const res = await fetch(`${REALMIO_BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": REALMIO_TENANT_ID,
      ...(effectiveOrigin ? { Origin: effectiveOrigin } : {}),
    },
    body: JSON.stringify({ name, email, password }),
    signal: AbortSignal.timeout(8000),
  });

  const data = await res.json();

  if (!res.ok) {
    const message = data?.message || data?.error || "Gagal membuat akun di sistem autentikasi";
    throw new Error(message);
  }

  const user = data.user ?? data;
  if (!user?.id) {
    throw new Error("Respons Realmio tidak valid: userId tidak ditemukan");
  }

  return { userId: user.id, email: user.email, name: user.name ?? name };
}

export { REALMIO_BASE_URL, REALMIO_TENANT_ID, DEV_BYPASS_AUTH, DEV_USER };
