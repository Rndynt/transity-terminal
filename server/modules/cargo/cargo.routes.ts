import type { FastifyInstance } from "fastify";
import { CargoController } from "./cargo.controller";
import { IStorage } from "@server/storage.interface";
import { requireFlag, requireOutletScope } from "@modules/rbac/rbac.middleware";

export function registerCargoRoutes(app: FastifyInstance, storage: IStorage) {
  const cargoController = new CargoController(storage);
  const write = { preHandler: [requireFlag('master.cargo_rates')] };

  app.get('/api/cargo-types', async (req, reply) => cargoController.getCargoTypes(req, reply));
  app.get('/api/cargo-types/:id', async (req, reply) => cargoController.getCargoTypeById(req, reply));
  app.post('/api/cargo-types', { preHandler: [requireFlag('master.cargo_types')] }, async (req, reply) => cargoController.createCargoType(req, reply));
  app.put('/api/cargo-types/:id', { preHandler: [requireFlag('master.cargo_types')] }, async (req, reply) => cargoController.updateCargoType(req, reply));
  app.delete('/api/cargo-types/:id', { preHandler: [requireFlag('master.cargo_types')] }, async (req, reply) => cargoController.deleteCargoType(req, reply));

  // Cargo OD-matrix pricing (mirrors /api/price-rules, + cargoTypeId dimension)
  app.get('/api/cargo-rates/priced-destinations', async (req, reply) => cargoController.cargoPricedDestinations(req, reply));
  app.get('/api/cargo-rates/pattern/:patternId', async (req, reply) => cargoController.getCargoRatePatternGrid(req, reply));
  app.put('/api/cargo-rates', write, async (req, reply) => cargoController.saveCargoRate(req, reply));
  app.patch('/api/cargo-rates/:id/active', write, async (req, reply) => cargoController.setCargoRateActive(req, reply));
  app.delete('/api/cargo-rates/:id', write, async (req, reply) => cargoController.deleteCargoRate(req, reply));
  app.post('/api/cargo-rates/duplicate', write, async (req, reply) => cargoController.duplicateCargoRate(req, reply));

  // Seasonal templates (pattern+cargoType-scoped)
  app.get('/api/cargo-rates/pattern/:patternId/seasonal', async (req, reply) => cargoController.listCargoSeasonalTemplates(req, reply));
  app.post('/api/cargo-rates/pattern/:patternId/seasonal', write, async (req, reply) => cargoController.createCargoSeasonalTemplate(req, reply));

  // Sync (read-time detection + manual button — no webhooks)
  app.get('/api/cargo-rates/pattern/:patternId/sync-status', async (req, reply) => cargoController.getCargoRateSyncStatus(req, reply));
  app.post('/api/cargo-rates/pattern/:patternId/sync', write, async (req, reply) => cargoController.syncCargoRate(req, reply));

  // Trip exceptions (per-trip, per-cargoType, per-OD overrides)
  app.get('/api/cargo-rates/trip-exceptions/:tripId', async (req, reply) => cargoController.listCargoTripExceptions(req, reply));
  app.put('/api/cargo-rates/trip-exceptions', write, async (req, reply) => cargoController.upsertCargoTripException(req, reply));
  app.delete('/api/cargo-rates/trip-exceptions/:id', write, async (req, reply) => cargoController.deleteCargoTripException(req, reply));

  app.get('/api/cargo/available-trips', async (req, reply) => cargoController.getAvailableTrips(req, reply));
  app.get('/api/cargo/quote-tariff', async (req, reply) => cargoController.quoteTariff(req, reply));

  app.get('/api/cargo', { preHandler: [requireOutletScope()] }, async (req, reply) => cargoController.getAll(req, reply));
  app.get('/api/cargo/waybill/:waybillNumber', async (req, reply) => cargoController.getByWaybill(req, reply));
  app.get('/api/cargo/:id', async (req, reply) => cargoController.getById(req, reply));
  app.post('/api/cargo', { preHandler: [requireFlag('action.cargo.create'), requireOutletScope()] }, async (req, reply) => cargoController.create(req, reply));
  app.put('/api/cargo/:id', { preHandler: [requireFlag('action.cargo.manage')] }, async (req, reply) => cargoController.update(req, reply));
  app.patch('/api/cargo/:id/status', { preHandler: [requireFlag('action.cargo.manage')] }, async (req, reply) => cargoController.updateStatus(req, reply));
}
