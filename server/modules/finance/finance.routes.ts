import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { IStorage } from "@server/storage.interface";
import { insertTripCostTemplateSchema, insertTripCostItemSchema } from "@shared/schema";
import { requireFlag } from "@modules/rbac/rbac.middleware";

export function registerFinanceRoutes(app: FastifyInstance, storage: IStorage) {
  app.get('/api/cost-templates', async (req: FastifyRequest, reply: FastifyReply) => {
    const { patternId } = req.query as { patternId?: string };
    const templates = await storage.getTripCostTemplates(patternId);
    const templatesWithItems = await Promise.all(
      templates.map(async (t) => {
        const items = await storage.getTripCostItems(t.id);
        return { ...t, items };
      })
    );
    reply.send(templatesWithItems);
  });

  app.get('/api/cost-templates/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const template = await storage.getTripCostTemplateById(id);
    if (!template) return reply.code(404).send({ message: 'Template tidak ditemukan' });
    const items = await storage.getTripCostItems(id);
    reply.send({ ...template, items });
  });

  app.post('/api/cost-templates', { preHandler: [requireFlag('master.cost_templates')] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = insertTripCostTemplateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.message });
    const template = await storage.createTripCostTemplate(parsed.data);
    reply.code(201).send(template);
  });

  app.put('/api/cost-templates/:id', { preHandler: [requireFlag('master.cost_templates')] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const parsed = insertTripCostTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.message });
    const template = await storage.updateTripCostTemplate(id, parsed.data);
    reply.send(template);
  });

  app.delete('/api/cost-templates/:id', { preHandler: [requireFlag('master.cost_templates')] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    await storage.deleteTripCostTemplate(id);
    reply.code(204).send();
  });

  app.get('/api/cost-templates/:templateId/items', async (req: FastifyRequest, reply: FastifyReply) => {
    const { templateId } = req.params as { templateId: string };
    const items = await storage.getTripCostItems(templateId);
    reply.send(items);
  });

  app.post('/api/cost-templates/:templateId/items', { preHandler: [requireFlag('master.cost_templates')] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { templateId } = req.params as { templateId: string };
    const parsed = insertTripCostItemSchema.safeParse({ ...(req.body as object), templateId });
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.message });
    const item = await storage.createTripCostItem(parsed.data);
    reply.code(201).send(item);
  });

  app.put('/api/cost-items/:id', { preHandler: [requireFlag('master.cost_templates')] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const parsed = insertTripCostItemSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.message });
    const item = await storage.updateTripCostItem(id, parsed.data);
    reply.send(item);
  });

  app.delete('/api/cost-items/:id', { preHandler: [requireFlag('master.cost_templates')] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    await storage.deleteTripCostItem(id);
    reply.code(204).send();
  });
}
