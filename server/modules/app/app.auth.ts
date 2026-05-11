import type { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  // P1-2 §3.12: tidak ada fallback "dev secret" lagi. Sebelumnya kalau
  // JWT_SECRET tidak ter-set di non-production env, app pakai
  // "transity-dev-" + REPL_ID — predictable per-deploy. Kalau env staging
  // lupa set JWT_SECRET, attacker bisa forge token mudah karena REPL_ID
  // public dari URL Replit.
  //
  // Note: server/index.ts:validateBootEnv juga enforce JWT_SECRET >=32
  // chars saat boot, jadi production app pasti sudah punya secret valid.
  // Pengecekan di sini guard untuk import paths alternatif (test runner,
  // CLI script) yang tidak lewat boot validation.
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "FATAL: JWT_SECRET environment variable is required. Generate via: openssl rand -hex 32"
    );
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

export interface AppUserPayload {
  userId: string;
  email: string;
}

const JWT_TTL = process.env.JWT_TTL || "24h";

export function signToken(payload: AppUserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_TTL as jwt.SignOptions["expiresIn"] });
}

export function verifyToken(token: string): AppUserPayload {
  return jwt.verify(token, JWT_SECRET) as AppUserPayload;
}

export async function appAuthMiddleware(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    req.appUser = payload;
  } catch {
    return reply.code(401).send({ error: "Invalid or expired token" });
  }
}

export async function optionalAuthMiddleware(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      req.appUser = verifyToken(token);
    } catch {
    }
  }
}
