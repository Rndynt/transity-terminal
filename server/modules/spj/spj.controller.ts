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
  estimatedAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  actualAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

/** Narrow an unknown caught error to a string message safely. */
function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export class SpjController {
  async getAll(req: FastifyRequest, reply: FastifyReply) {
    try {
      const list = await spjService.getAll();
      reply.send(list);
    } catch (e) {
      reply.code(500).send({ error: errorMessage(e) });
    }
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const spj = await spjService.getById(id);
      if (!spj) return reply.code(404).send({ error: "SPJ tidak ditemukan" });
      reply.send(spj);
    } catch (e) {
      reply.code(500).send({ error: errorMessage(e) });
    }
  }

  async getByTripId(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { tripId } = req.params as { tripId: string };
      const spj = await spjService.getByTripId(tripId);
      reply.send(spj);
    } catch (e) {
      reply.code(500).send({ error: errorMessage(e) });
    }
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { tripId, driverId, vehicleId, notes } = req.body as { tripId?: string; driverId?: string; vehicleId?: string; notes?: string };
      if (!tripId) return reply.code(400).send({ error: "tripId wajib diisi" });
      const spj = await spjService.create(tripId, { driverId, vehicleId, notes });
      reply.code(201).send(spj);
    } catch (e) {
      reply.code(400).send({ error: errorMessage(e) });
    }
  }

  async issue(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const spj = await spjService.updateStatus(id, 'issued');
      reply.send(spj);
    } catch (e) {
      reply.code(400).send({ error: errorMessage(e) });
    }
  }

  async settle(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const spj = await spjService.updateStatus(id, 'settled');
      reply.send(spj);
    } catch (e) {
      reply.code(400).send({ error: errorMessage(e) });
    }
  }

  async updateNotes(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      const { notes } = (req.body ?? {}) as { notes?: string };
      const spj = await spjService.updateNotes(id, notes || '');
      reply.send(spj);
    } catch (e) {
      reply.code(400).send({ error: errorMessage(e) });
    }
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      await spjService.delete(id);
      reply.send({ success: true });
    } catch (e) {
      reply.code(400).send({ error: errorMessage(e) });
    }
  }

  async updateCostLine(req: FastifyRequest, reply: FastifyReply) {
    try {
      const parsed = updateCostLineSchema.parse(req.body);
      const { id } = req.params as { id: string };
      const line = await spjService.updateCostLine(id, parsed);
      reply.send(line);
    } catch (e) {
      if (e instanceof z.ZodError) return reply.code(400).send({ error: 'Invalid input', details: e.errors });
      reply.code(400).send({ error: errorMessage(e) });
    }
  }

  async addCostLine(req: FastifyRequest, reply: FastifyReply) {
    try {
      const parsed = addCostLineSchema.parse(req.body);
      const { spjId } = req.params as { spjId: string };
      const line = await spjService.addCostLine(spjId, parsed);
      reply.code(201).send(line);
    } catch (e) {
      if (e instanceof z.ZodError) return reply.code(400).send({ error: 'Invalid input', details: e.errors });
      reply.code(400).send({ error: errorMessage(e) });
    }
  }

  async deleteCostLine(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = req.params as { id: string };
      await spjService.deleteCostLine(id);
      reply.send({ success: true });
    } catch (e) {
      reply.code(400).send({ error: errorMessage(e) });
    }
  }

  async getTripProfit(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { tripId } = req.params as { tripId: string };
      const profit = await spjService.getTripProfit(tripId);
      reply.send(profit);
    } catch (e) {
      reply.code(500).send({ error: errorMessage(e) });
    }
  }
}
