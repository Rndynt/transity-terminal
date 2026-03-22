import type { FastifyInstance } from "fastify";
import { CargoController } from "./cargo.controller";
import { IStorage } from "../../storage.interface";
import { requireFlag, requireOutletScope } from "../rbac/rbac.middleware";

export function registerCargoRoutes(app: FastifyInstance, storage: IStorage) {
  const cargoController = new CargoController(storage);

  app.get('/api/cargo-types', async (req, reply) => cargoController.getCargoTypes(req, reply));
  app.get('/api/cargo-types/:id', async (req, reply) => cargoController.getCargoTypeById(req, reply));
  app.post('/api/cargo-types', { preHandler: [requireFlag('master.cargo_types')] }, async (req, reply) => cargoController.createCargoType(req, reply));
  app.put('/api/cargo-types/:id', { preHandler: [requireFlag('master.cargo_types')] }, async (req, reply) => cargoController.updateCargoType(req, reply));
  app.delete('/api/cargo-types/:id', { preHandler: [requireFlag('master.cargo_types')] }, async (req, reply) => cargoController.deleteCargoType(req, reply));

  app.get('/api/cargo-rates', async (req, reply) => cargoController.getCargoRates(req, reply));
  app.get('/api/cargo-rates/:id', async (req, reply) => cargoController.getCargoRateById(req, reply));
  app.post('/api/cargo-rates', { preHandler: [requireFlag('master.cargo_rates')] }, async (req, reply) => cargoController.createCargoRate(req, reply));
  app.put('/api/cargo-rates/:id', { preHandler: [requireFlag('master.cargo_rates')] }, async (req, reply) => cargoController.updateCargoRate(req, reply));
  app.delete('/api/cargo-rates/:id', { preHandler: [requireFlag('master.cargo_rates')] }, async (req, reply) => cargoController.deleteCargoRate(req, reply));

  app.get('/api/cargo/quote-tariff', async (req, reply) => cargoController.quoteTariff(req, reply));

  app.get('/api/cargo', { preHandler: [requireOutletScope()] }, async (req, reply) => cargoController.getAll(req, reply));
  app.get('/api/cargo/waybill/:waybillNumber', async (req, reply) => cargoController.getByWaybill(req, reply));
  app.get('/api/cargo/:id', async (req, reply) => cargoController.getById(req, reply));
  app.post('/api/cargo', { preHandler: [requireFlag('action.cargo.create'), requireOutletScope()] }, async (req, reply) => cargoController.create(req, reply));
  app.put('/api/cargo/:id', { preHandler: [requireFlag('action.cargo.manage')] }, async (req, reply) => cargoController.update(req, reply));
  app.patch('/api/cargo/:id/status', { preHandler: [requireFlag('action.cargo.manage')] }, async (req, reply) => cargoController.updateStatus(req, reply));
}
