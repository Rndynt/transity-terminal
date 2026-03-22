import type { Request, Response, NextFunction } from "express";
import { getEffectivePermissions, type EffectivePermissions } from "../rbac/rbac.service";

export interface RealmioUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string | null;
  createdAt: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: RealmioUser;
      rbac?: EffectivePermissions;
      scopedOutletId?: string | null;
    }
  }
}

const AUTHCORE_BASE_URL = process.env.AUTHCORE_BASE_URL || "";
const AUTHCORE_TENANT_ID = process.env.AUTHCORE_TENANT_ID || "transity";
const DEV_BYPASS_AUTH =
  process.env.NODE_ENV !== "production" &&
  (process.env.DEV_BYPASS_AUTH === "true" || !AUTHCORE_BASE_URL);

const DEV_USER: RealmioUser = {
  id: "dev-user-001",
  email: "cso@transity.id",
  name: "CSO Development",
  image: null,
  role: "cso",
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

async function attachRbac(req: Request): Promise<void> {
  if (!req.user) return;
  try {
    req.rbac = await getEffectivePermissions(req.user.id, req.user.role);
  } catch {
    req.rbac = { flags: new Set(), outletId: null, roleId: req.user.role ?? null };
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (DEV_BYPASS_AUTH) {
    req.user = DEV_USER;
    attachRbac(req).then(() => next()).catch(() => next());
    return;
  }

  verifyWithRealmio(req.headers.cookie, req.headers.authorization)
    .then(async (user) => {
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      req.user = user;
      await attachRbac(req);
      next();
    })
    .catch(() => {
      res.status(401).json({ message: "Unauthorized" });
    });
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  if (DEV_BYPASS_AUTH) {
    req.user = DEV_USER;
    attachRbac(req).then(() => next()).catch(() => next());
    return;
  }

  verifyWithRealmio(req.headers.cookie, req.headers.authorization)
    .then(async (user) => {
      if (user) {
        req.user = user;
        await attachRbac(req);
      }
      next();
    })
    .catch(() => {
      next();
    });
}

export { AUTHCORE_BASE_URL, AUTHCORE_TENANT_ID, DEV_BYPASS_AUTH, DEV_USER };
