import type { FastifyRequest, FastifyReply } from "fastify";
import { VehiclesService } from "./vehicles.service";
import { IStorage } from "../../storage.interface";
import { insertVehicleSchema } from "@shared/schema";

export class VehiclesController {
  private vehiclesService: VehiclesService;

  constructor(storage: IStorage) {
    this.vehiclesService = new VehiclesService(storage);
  }

  async getAll(req: FastifyRequest, reply: FastifyReply) {
    const vehicles = await this.vehiclesService.getAllVehicles();
    reply.send(vehicles);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params;
    const vehicle = await this.vehiclesService.getVehicleById(id);
    reply.send(vehicle);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const validatedData = insertVehicleSchema.parse(req.body);
    const vehicle = await this.vehiclesService.createVehicle(validatedData);
    reply.code(201).send(vehicle);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params;
    const validatedData = insertVehicleSchema.partial().parse(req.body);
    const vehicle = await this.vehiclesService.updateVehicle(id, validatedData);
    reply.send(vehicle);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params;
    await this.vehiclesService.deleteVehicle(id);
    reply.code(204).send();
  }
}
