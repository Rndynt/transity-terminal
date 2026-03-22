import type { FastifyRequest, FastifyReply } from "fastify";
import { DriversService } from "./drivers.service";
import { IStorage } from "../../routes";
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
    const driver = await this.service.getDriverById(req.params.id);
    reply.send(driver);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const data = insertDriverSchema.parse(req.body);
    const driver = await this.service.createDriver(data);
    reply.code(201).send(driver);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const data = insertDriverSchema.partial().parse(req.body);
    const driver = await this.service.updateDriver(req.params.id, data);
    reply.send(driver);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    await this.service.deleteDriver(req.params.id);
    reply.code(204).send();
  }
}
