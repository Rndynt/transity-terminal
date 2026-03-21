import type { Express, Request, Response } from "express";
import {
  AUTHCORE_BASE_URL,
  AUTHCORE_TENANT_ID,
  DEV_BYPASS_AUTH,
  DEV_USER,
} from "./realmio";

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/sign-in/email", async (req: Request, res: Response) => {
    if (DEV_BYPASS_AUTH) {
      return res.json({
        user: DEV_USER,
        session: {
          id: "dev-session-001",
          token: "dev-token",
          userId: DEV_USER.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
    }

    try {
      const upstream = await fetch(`${AUTHCORE_BASE_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": AUTHCORE_TENANT_ID,
          ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {}),
        },
        body: JSON.stringify(req.body),
      });

      const setCookies = upstream.headers.getSetCookie?.() ?? [];
      for (const c of setCookies) {
        res.append("Set-Cookie", c);
      }

      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    } catch (err) {
      return res.status(502).json({ message: "Auth service unavailable" });
    }
  });

  app.post("/api/auth/sign-up/email", async (req: Request, res: Response) => {
    if (DEV_BYPASS_AUTH) {
      return res.json({
        user: { ...DEV_USER, email: req.body.email, name: req.body.name },
        session: {
          id: "dev-session-001",
          token: "dev-token",
          userId: DEV_USER.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
    }

    try {
      const upstream = await fetch(`${AUTHCORE_BASE_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": AUTHCORE_TENANT_ID,
        },
        body: JSON.stringify(req.body),
      });

      const setCookies = upstream.headers.getSetCookie?.() ?? [];
      for (const c of setCookies) {
        res.append("Set-Cookie", c);
      }

      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    } catch (err) {
      return res.status(502).json({ message: "Auth service unavailable" });
    }
  });

  app.post("/api/auth/sign-out", async (req: Request, res: Response) => {
    if (DEV_BYPASS_AUTH) {
      return res.json({ success: true });
    }

    try {
      const upstream = await fetch(`${AUTHCORE_BASE_URL}/api/auth/sign-out`, {
        method: "POST",
        headers: {
          "X-Tenant-Id": AUTHCORE_TENANT_ID,
          ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {}),
        },
      });

      const setCookies = upstream.headers.getSetCookie?.() ?? [];
      for (const c of setCookies) {
        res.append("Set-Cookie", c);
      }

      const data = await upstream.json();
      return res.status(upstream.status).json(data);
    } catch (err) {
      return res.status(502).json({ message: "Auth service unavailable" });
    }
  });

  app.get("/api/auth/session", async (req: Request, res: Response) => {
    if (DEV_BYPASS_AUTH) {
      return res.json({
        user: DEV_USER,
        session: {
          id: "dev-session-001",
          token: "dev-token",
          userId: DEV_USER.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
    }

    try {
      const upstream = await fetch(`${AUTHCORE_BASE_URL}/api/auth/get-session`, {
        headers: {
          "X-Tenant-Id": AUTHCORE_TENANT_ID,
          ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {}),
          ...(req.headers.authorization
            ? { Authorization: req.headers.authorization }
            : {}),
        },
      });

      if (!upstream.ok) {
        return res.status(401).json({ user: null, session: null });
      }

      const data = await upstream.json();
      return res.json(data);
    } catch (err) {
      return res.status(401).json({ user: null, session: null });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (DEV_BYPASS_AUTH) {
      return res.json({
        user: DEV_USER,
        tenant: { id: AUTHCORE_TENANT_ID, slug: AUTHCORE_TENANT_ID },
      });
    }

    try {
      const upstream = await fetch(`${AUTHCORE_BASE_URL}/me`, {
        headers: {
          "X-Tenant-Id": AUTHCORE_TENANT_ID,
          ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {}),
          ...(req.headers.authorization
            ? { Authorization: req.headers.authorization }
            : {}),
        },
      });

      if (!upstream.ok) {
        return res.status(401).json({ user: null });
      }

      const data = await upstream.json();
      return res.json(data);
    } catch (err) {
      return res.status(401).json({ user: null });
    }
  });
}
