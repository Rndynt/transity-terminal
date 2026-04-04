import type { FastifyInstance } from "fastify";
import { TripPatternsController } from "./tripPatterns.controller";
import { PatternStopsController } from "@server/modules/patternStops/patternStops.controller";
import { IStorage } from "@server/storage.interface";
import { requireFlag } from "@server/modules/rbac/rbac.middleware";

export function registerTripPatternsRoutes(app: FastifyInstance, storage: IStorage, cacheHook: any) {
  const tripPatternsController = new TripPatternsController(storage);
  const patternStopsController = new PatternStopsController(storage);

  app.get('/api/trip-patterns', { ...cacheHook }, async (req, reply) => tripPatternsController.getAll(req, reply));
  app.get('/api/trip-patterns/:id', { ...cacheHook }, async (req, reply) => tripPatternsController.getById(req, reply));
  app.post('/api/trip-patterns', { preHandler: [requireFlag('master.trip_patterns')] }, async (req, reply) => tripPatternsController.create(req, reply));
  app.put('/api/trip-patterns/:id', { preHandler: [requireFlag('master.trip_patterns')] }, async (req, reply) => tripPatternsController.update(req, reply));
  app.delete('/api/trip-patterns/:id', { preHandler: [requireFlag('master.trip_patterns')] }, async (req, reply) => tripPatternsController.delete(req, reply));
  app.get('/api/trip-patterns/:id/impact', async (req, reply) => tripPatternsController.getImpact(req, reply));

  app.get('/api/trip-patterns/:patternId/stops', async (req, reply) => patternStopsController.getByPattern(req, reply));
  app.post('/api/pattern-stops', { preHandler: [requireFlag('master.trip_patterns')] }, async (req, reply) => patternStopsController.create(req, reply));
  app.put('/api/pattern-stops/:id', { preHandler: [requireFlag('master.trip_patterns')] }, async (req, reply) => patternStopsController.update(req, reply));
  app.delete('/api/pattern-stops/:id', { preHandler: [requireFlag('master.trip_patterns')] }, async (req, reply) => patternStopsController.delete(req, reply));
  app.post('/api/trip-patterns/:patternId/stops/bulk-replace', { preHandler: [requireFlag('master.trip_patterns')] }, async (req, reply) => patternStopsController.bulkReplace(req, reply));
}
