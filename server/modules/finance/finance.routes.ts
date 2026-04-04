import type { FastifyInstance } from "fastify";
import { IStorage } from "@server/storage.interface";
import { insertTripCostTemplateSchema, insertTripCostItemSchema } from "@shared/schema";
import { requireFlag } from "@modules/rbac/rbac.middleware";

export function registerFinanceRoutes(app: FastifyInstance, storage: IStorage) {
  app.get('/api/cost-templates', async (req: any, reply: any) => {
    const patternId = req.query.patternId as string | undefined;
    const templates = await storage.getTripCostTemplates(patternId);
    const templatesWithItems = await Promise.all(
      templates.map(async (t) => {
        const items = await storage.getTripCostItems(t.id);
        return { ...t, items };
      })
    );
    reply.send(templatesWithItems);
  });

  app.get('/api/cost-templates/:id', async (req: any, reply: any) => {
    const template = await storage.getTripCostTemplateById(req.params.id);
    if (!template) return reply.code(404).send({ message: 'Template tidak ditemukan' });
    const items = await storage.getTripCostItems(req.params.id);
    reply.send({ ...template, items });
  });

  app.post('/api/cost-templates', { preHandler: [requireFlag('master.cost_templates')] }, async (req: any, reply: any) => {
    const parsed = insertTripCostTemplateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.message });
    const template = await storage.createTripCostTemplate(parsed.data);
    reply.code(201).send(template);
  });

  app.put('/api/cost-templates/:id', { preHandler: [requireFlag('master.cost_templates')] }, async (req: any, reply: any) => {
    const parsed = insertTripCostTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.message });
    const template = await storage.updateTripCostTemplate(req.params.id, parsed.data);
    reply.send(template);
  });

  app.delete('/api/cost-templates/:id', { preHandler: [requireFlag('master.cost_templates')] }, async (req: any, reply: any) => {
    await storage.deleteTripCostTemplate(req.params.id);
    reply.code(204).send();
  });

  app.get('/api/cost-templates/:templateId/items', async (req: any, reply: any) => {
    const items = await storage.getTripCostItems(req.params.templateId);
    reply.send(items);
  });

  app.post('/api/cost-templates/:templateId/items', { preHandler: [requireFlag('master.cost_templates')] }, async (req: any, reply: any) => {
    const parsed = insertTripCostItemSchema.safeParse({ ...req.body, templateId: req.params.templateId });
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.message });
    const item = await storage.createTripCostItem(parsed.data);
    reply.code(201).send(item);
  });

  app.put('/api/cost-items/:id', { preHandler: [requireFlag('master.cost_templates')] }, async (req: any, reply: any) => {
    const parsed = insertTripCostItemSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.message });
    const item = await storage.updateTripCostItem(req.params.id, parsed.data);
    reply.send(item);
  });

  app.delete('/api/cost-items/:id', { preHandler: [requireFlag('master.cost_templates')] }, async (req: any, reply: any) => {
    await storage.deleteTripCostItem(req.params.id);
    reply.code(204).send();
  });
}
