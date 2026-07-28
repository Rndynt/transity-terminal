import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyInstance } from "fastify";
import type { Trip, Outlet, Stop, Vehicle, TripPattern, Layout, Promotion, PromoCondition } from "@shared/schema";

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
 *  - Promotions: trip search enriches every trip on the results page with
 *    `findBestAutoApplicablePromo()`, which reads the *entire* promotions
 *    table + their conditions. That data is identical for every trip in
 *    one response (only per-trip eligibility differs, evaluated in-memory)
 *    — without this cache a full page of results fired one getPromotions()
 *    + one getPromoConditionsForPromos() per trip, all concurrently, up to
 *    ~2x the page size in redundant DB round-trips per search request.
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
  /** getPromotions() takes no args and returns the full table, so this is
   *  a single slot rather than an id-keyed Map like the caches above. */
  promotionsCache: Promise<Promotion[]> | undefined;
  /** Keyed by the sorted/joined promoIds requested, so a repeat call with
   *  the same id set (the common case — see doc above) hits the cache,
   *  while a differently-scoped call is still always correct (cache miss,
   *  fetched fresh) rather than risking a wrong answer. */
  promoConditionsCache: Map<string, Promise<Map<string, PromoCondition[]>>>;
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
    promotionsCache: undefined,
    promoConditionsCache: new Map(),
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
