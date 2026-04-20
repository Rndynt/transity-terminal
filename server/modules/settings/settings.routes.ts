import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireFlag } from "@modules/rbac/rbac.middleware";
import { db } from "@server/db";
import { operatorSettings } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { getConsoleHealth, sendTestEvent } from "@server/lib/consoleWebhook";

// B8: Zod schema for PUT /api/settings body. All fields optional (partial
// update). Color fields validated as 6-digit hex (#RRGGBB). URL field
// validated as URL when provided & non-empty.
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'must be #RRGGBB');
const updateSettingsSchema = z.object({
  brandName:      z.string().min(1).max(100).optional(),
  tagline:        z.string().max(200).optional(),
  // logoUrl: empty string allowed to clear, otherwise must be valid URL.
  logoUrl:        z.union([z.string().url(), z.literal('')]).nullable().optional(),
  primaryColor:   hexColor.optional(),
  secondaryColor: hexColor.optional(),
  accentColor:    hexColor.optional(),
}).strict();

const logoBodySchema = z.object({
  logoUrl: z.string().url(),
}).strict();

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
    // B8: validate body strictly with Zod before touching DB.
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
    }
    const body = parsed.data;
    const current = await getOrCreateSettings();

    const updates: Record<string, any> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined) updates[k] = v;
    }

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
    // B8: validate body — must be a real URL.
    const parsed = logoBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
    }
    const current = await getOrCreateSettings();
    const [updated] = await db.update(operatorSettings)
      .set({ logoUrl: parsed.data.logoUrl, updatedAt: new Date() })
      .where(eq(operatorSettings.id, current.id))
      .returning();
    reply.send(updated);
  });

  app.get(
    '/api/settings/console-webhook',
    { preHandler: [requireFlag('admin.flags.manage')] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      reply.send(getConsoleHealth());
    }
  );

  app.post(
    '/api/settings/console-webhook/test',
    { preHandler: [requireFlag('admin.flags.manage')] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const health = getConsoleHealth();
      if (!health.configured) {
        return reply.code(400).send({
          ok: false,
          reason: 'not_configured',
          missing: health.missing,
          health,
        });
      }
      const result = await sendTestEvent();
      reply.send({ result, health: getConsoleHealth() });
    }
  );
}
