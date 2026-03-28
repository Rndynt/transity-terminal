import type { FastifyRequest, FastifyReply } from "fastify";
import { getEffectivePermissions, type EffectivePermissions } from "../rbac/rbac.service";

export interface RealmioUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string | null;
  createdAt: string;
}

const AUTHCORE_BASE_URL = process.env.AUTHCORE_BASE_URL || "";
const AUTHCORE_TENANT_ID = process.env.AUTHCORE_TENANT_ID || "transity";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const DEV_BYPASS_AUTH =
  process.env.DEV_BYPASS_AUTH === "true" || (!IS_PRODUCTION && !AUTHCORE_BASE_URL);

if (IS_PRODUCTION && !AUTHCORE_BASE_URL && !DEV_BYPASS_AUTH) {
  console.error("FATAL: AUTHCORE_BASE_URL is required in production. Auth will reject all requests.");
}

if (DEV_BYPASS_AUTH) {
  console.log("[AUTH] Bypass auth enabled — all requests use dev user");
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
  if (!AUTHCORE_BASE_URL) return null;

  const headers: Record<string, string> = {
    "X-Tenant-Id": AUTHCORE_TENANT_ID,
  };

  if (cookieHeader) headers["Cookie"] = cookieHeader;
  if (authHeader) headers["Authorization"] = authHeader;

  try {
    const res = await fetch(`${AUTHCORE_BASE_URL}/me`, { headers });
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

export async function optionalAuth(req: FastifyRequest, _reply: FastifyReply) {
  if (DEV_BYPASS_AUTH) {
    req.user = DEV_USER;
    await attachRbac(req);
    return;
  }

  try {
    const user = await verifyWithRealmio(req.headers.cookie, req.headers.authorization);
    if (user) {
      req.user = user;
      await attachRbac(req);
    }
  } catch {
  }
}

export { AUTHCORE_BASE_URL, AUTHCORE_TENANT_ID, DEV_BYPASS_AUTH, DEV_USER };
