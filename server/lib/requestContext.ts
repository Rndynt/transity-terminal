import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyInstance } from "fastify";
import type { Trip, Outlet, Stop, Vehicle, TripPattern, Layout } from "@shared/schema";

/**
 * Request-scoped context for in-flight memoization. Each Fastify request
 * runs inside its own `als.run()` so caches are scoped to a single
 * request lifecycle and never bleed across requests.
 *
 * Used for high-reuse master entities that are looked up multiple times
 * during a single request lifecycle:
 *
 *  - Trip lookups: a booking flow typically calls `storage.getTripById(id)`
 *    3-5 times for the same trip (snapshot fetch + boarding validation +
 *    fare calculation).
 *  - Master data (outlet/stop/vehicle/tripPattern/layout): 9-14 call sites
 *    each across booking, cargo, manifest, snapshots. Booking detail flow
 *    alone calls `getStopById` 3+ times (origin + destination + fare lookup).
 *
 * Memoizing the in-flight Promise turns those into a single DB round-trip
 * per request. Caches are scoped to a single request lifecycle and never
 * bleed across requests, so staleness is bounded to request duration.
 */
export interface RequestContext {
  tripCache: Map<string, Promise<Trip | undefined>>;
  outletCache: Map<string, Promise<Outlet | undefined>>;
  stopCache: Map<string, Promise<Stop | undefined>>;
  vehicleCache: Map<string, Promise<Vehicle | undefined>>;
  tripPatternCache: Map<string, Promise<TripPattern | undefined>>;
  layoutCache: Map<string, Promise<Layout | undefined>>;
}

const als = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return als.getStore();
}

export function createRequestContext(): RequestContext {
  return {
    tripCache: new Map(),
    outletCache: new Map(),
    stopCache: new Map(),
    vehicleCache: new Map(),
    tripPatternCache: new Map(),
    layoutCache: new Map(),
  };
}

/**
 * Register a Fastify hook that wraps each request in an `als.run()` so
 * downstream code can `getRequestContext()` to access per-request caches.
 *
 * Idempotent — safe to call once on app boot.
 */
export function registerRequestContextHook(app: FastifyInstance): void {
  app.addHook("onRequest", (req, _reply, done) => {
    const ctx = createRequestContext();
    als.run(ctx, () => done());
  });
}
