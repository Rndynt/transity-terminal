import type { FastifyRequest, FastifyReply } from "fastify";
import { DriversService } from "./drivers.service";
import { IStorage } from "@server/storage.interface";
import { insertDriverSchema } from "@shared/schema";

export class DriversController {
  private service: DriversService;

  constructor(storage: IStorage) {
    this.service = new DriversService(storage);
  }

  async getAll(req: FastifyRequest, reply: FastifyReply) {
    const drivers = await this.service.getAllDrivers();
    reply.send(drivers);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const driver = await this.service.getDriverById(id);
    reply.send(driver);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const data = insertDriverSchema.parse(req.body);
    const driver = await this.service.createDriver(data);
    reply.code(201).send(driver);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const data = insertDriverSchema.partial().parse(req.body);
    const driver = await this.service.updateDriver(id, data);
    reply.send(driver);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await this.service.deleteDriver(id);
    reply.code(204).send();
  }
}
