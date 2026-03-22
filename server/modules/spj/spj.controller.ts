import type { FastifyRequest, FastifyReply } from "fastify";
import { SpjService } from "./spj.service";

const spjService = new SpjService();

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
      const line = await spjService.updateCostLine(req.params.id, req.body);
      reply.send(line);
    } catch (e: any) {
      reply.code(400).send({ error: e.message });
    }
  }

  async addCostLine(req: FastifyRequest, reply: FastifyReply) {
    try {
      const line = await spjService.addCostLine(req.params.spjId, req.body);
      reply.code(201).send(line);
    } catch (e: any) {
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
