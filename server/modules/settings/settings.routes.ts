import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireFlag } from "../rbac/rbac.middleware";
import { db } from "@server/db";
import { operatorSettings } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

async function getOrCreateSettings() {
  const rows = await db.select().from(operatorSettings).limit(1);
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(operatorSettings).values({}).returning();
  return created;
}

export function registerSettingsRoutes(app: FastifyInstance) {
  app.get('/api/settings', async (_req: FastifyRequest, reply: FastifyReply) => {
    const settings = await getOrCreateSettings();
    reply.send(settings);
  });

  app.put('/api/settings', { preHandler: [requireFlag('admin.flags.manage')] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    const current = await getOrCreateSettings();

    const updates: Record<string, any> = {};
    if (body.brandName !== undefined) updates.brandName = body.brandName;
    if (body.tagline !== undefined) updates.tagline = body.tagline;
    if (body.logoUrl !== undefined) updates.logoUrl = body.logoUrl;
    if (body.primaryColor !== undefined) updates.primaryColor = body.primaryColor;
    if (body.secondaryColor !== undefined) updates.secondaryColor = body.secondaryColor;
    if (body.accentColor !== undefined) updates.accentColor = body.accentColor;

    if (Object.keys(updates).length === 0) {
      return reply.send(current);
    }

    updates.updatedAt = new Date();
    const [updated] = await db.update(operatorSettings)
      .set(updates)
      .where(eq(operatorSettings.id, current.id))
      .returning();

    reply.send(updated);
  });

  app.post('/api/settings/logo', { preHandler: [requireFlag('admin.flags.manage')] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    if (!body?.logoUrl) {
      return reply.code(400).send({ error: 'logoUrl is required' });
    }
    const current = await getOrCreateSettings();
    const [updated] = await db.update(operatorSettings)
      .set({ logoUrl: body.logoUrl, updatedAt: new Date() })
      .where(eq(operatorSettings.id, current.id))
      .returning();
    reply.send(updated);
  });
}
