import type { FastifyRequest, FastifyReply } from "fastify";
import { LayoutsService } from "./layouts.service";
import { IStorage } from "../../storage.interface";
import { insertLayoutSchema } from "@shared/schema";

export class LayoutsController {
  private layoutsService: LayoutsService;

  constructor(storage: IStorage) {
    this.layoutsService = new LayoutsService(storage);
  }

  async getAll(req: FastifyRequest, reply: FastifyReply) {
    const layouts = await this.layoutsService.getAllLayouts();
    reply.send(layouts);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params;
    const layout = await this.layoutsService.getLayoutById(id);
    reply.send(layout);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const validatedData = insertLayoutSchema.parse(req.body);
    const layout = await this.layoutsService.createLayout(validatedData);
    reply.code(201).send(layout);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params;
    const validatedData = insertLayoutSchema.partial().parse(req.body);
    const layout = await this.layoutsService.updateLayout(id, validatedData);
    reply.send(layout);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params;
    await this.layoutsService.deleteLayout(id);
    reply.code(204).send();
  }
}
