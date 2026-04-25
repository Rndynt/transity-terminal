import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyInstance } from "fastify";
import type { Trip } from "@shared/schema";

/**
 * Request-scoped context for in-flight memoization. Each Fastify request
 * runs inside its own `als.run()` so caches are scoped to a single
 * request lifecycle and never bleed across requests.
 *
 * Currently used for:
 *  - Trip lookups: a booking flow typically calls `storage.getTripById(id)`
 *    3-5 times for the same trip (snapshot fetch + boarding validation +
 *    fare calculation). Memoizing the in-flight Promise turns those into
 *    a single DB round-trip.
 */
export interface RequestContext {
  tripCache: Map<string, Promise<Trip | undefined>>;
}

const als = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return als.getStore();
}

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return als.run(ctx, fn);
}

export function createRequestContext(): RequestContext {
  return { tripCache: new Map() };
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
