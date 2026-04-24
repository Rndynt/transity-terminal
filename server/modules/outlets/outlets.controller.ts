import type { FastifyRequest, FastifyReply } from "fastify";
import { OutletsService } from "./outlets.service";
import { IStorage } from "@server/storage.interface";
import { insertOutletSchema } from "@shared/schema";
import { buildServiceContext } from "@modules/rbac/rbac.guard";

export class OutletsController {
  private outletsService: OutletsService;

  constructor(storage: IStorage) {
    this.outletsService = new OutletsService(storage);
  }

  async getAll(req: FastifyRequest, reply: FastifyReply) {
    const outlets = await this.outletsService.getAllOutlets();
    reply.send(outlets);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const outlet = await this.outletsService.getOutletById(id);
    reply.send(outlet);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const validatedData = insertOutletSchema.parse(req.body);
    const outlet = await this.outletsService.createOutlet(validatedData, buildServiceContext(req));
    reply.code(201).send(outlet);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const validatedData = insertOutletSchema.partial().parse(req.body);
    const outlet = await this.outletsService.updateOutlet(id, validatedData, buildServiceContext(req));
    reply.send(outlet);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await this.outletsService.deleteOutlet(id, buildServiceContext(req));
    reply.code(204).send();
  }
}
