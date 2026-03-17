import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SECRET environment variable is required in production");
    }
    console.warn("[app.auth] JWT_SECRET env var not set. Using development fallback. Set JWT_SECRET for production!");
    return "transity-dev-" + (process.env.REPL_ID || "local-dev-only");
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

export interface AppUserPayload {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  appUser?: AppUserPayload;
}

export function signToken(payload: AppUserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): AppUserPayload {
  return jwt.verify(token, JWT_SECRET) as AppUserPayload;
}

export function appAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    req.appUser = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function optionalAuthMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      req.appUser = verifyToken(token);
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
}
