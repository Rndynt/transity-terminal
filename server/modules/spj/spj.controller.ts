import type { FastifyRequest, FastifyReply } from "fastify";
import { SpjService } from "./spj.service";
import { z } from "zod";

const spjService = new SpjService();

const addCostLineSchema = z.object({
  category: z.string().min(1),
  label: z.string().min(1).max(200),
  estimatedAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  isAdvance: z.boolean(),
  notes: z.string().max(500).optional(),
});

const updateCostLineSchema = z.object({
  actualAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export class SpjController {
  async getAll(req: FastifyRequest, reply: FastifyReply) {
    try {
      const list = await spjService.getAll();
      reply.send(list);
    } catch (e: any) {
      reply.code(500).send({ error: e.message });
    }
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const spj = await spjService.getById(req.params.id);
      if (!spj) return reply.code(404).send({ error: "SPJ tidak ditemukan" });
      reply.send(spj);
    } catch (e: any) {
      reply.code(500).send({ error: e.message });
    }
  }

  async getByTripId(req: FastifyRequest, reply: FastifyReply) {
    try {
      const spj = await spjService.getByTripId(req.params.tripId);
      reply.send(spj);
    } catch (e: any) {
      reply.code(500).send({ error: e.message });
    }
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { tripId, driverId, vehicleId, notes } = req.body;
      if (!tripId) return reply.code(400).send({ error: "tripId wajib diisi" });
      const spj = await spjService.create(tripId, { driverId, vehicleId, notes });
      reply.code(201).send(spj);
    } catch (e: any) {
      reply.code(400).send({ error: e.message });
    }
  }

  async issue(req: FastifyRequest, reply: FastifyReply) {
    try {
      const spj = await spjService.updateStatus(req.params.id, 'issued');
      reply.send(spj);
    } catch (e: any) {
      reply.code(400).send({ error: e.message });
    }
  }

  async settle(req: FastifyRequest, reply: FastifyReply) {
    try {
      const spj = await spjService.updateStatus(req.params.id, 'settled');
      reply.send(spj);
    } catch (e: any) {
      reply.code(400).send({ error: e.message });
    }
  }

  async updateNotes(req: FastifyRequest, reply: FastifyReply) {
    try {
      const spj = await spjService.updateNotes(req.params.id, req.body.notes || '');
      reply.send(spj);
    } catch (e: any) {
      reply.code(400).send({ error: e.message });
    }
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    try {
      await spjService.delete(req.params.id);
      reply.send({ success: true });
    } catch (e: any) {
      reply.code(400).send({ error: e.message });
    }
  }

  async updateCostLine(req: FastifyRequest, reply: FastifyReply) {
    try {
      const parsed = updateCostLineSchema.parse(req.body);
      const line = await spjService.updateCostLine((req.params as any).id, parsed);
      reply.send(line);
    } catch (e: any) {
      if (e.name === 'ZodError') return reply.code(400).send({ error: 'Invalid input', details: e.errors });
      reply.code(400).send({ error: e.message });
    }
  }

  async addCostLine(req: FastifyRequest, reply: FastifyReply) {
    try {
      const parsed = addCostLineSchema.parse(req.body);
      const line = await spjService.addCostLine((req.params as any).spjId, parsed);
      reply.code(201).send(line);
    } catch (e: any) {
      if (e.name === 'ZodError') return reply.code(400).send({ error: 'Invalid input', details: e.errors });
      reply.code(400).send({ error: e.message });
    }
  }

  async deleteCostLine(req: FastifyRequest, reply: FastifyReply) {
    try {
      await spjService.deleteCostLine(req.params.id);
      reply.send({ success: true });
    } catch (e: any) {
      reply.code(400).send({ error: e.message });
    }
  }

  async getTripProfit(req: FastifyRequest, reply: FastifyReply) {
    try {
      const profit = await spjService.getTripProfit(req.params.tripId);
      reply.send(profit);
    } catch (e: any) {
      reply.code(500).send({ error: e.message });
    }
  }
}
