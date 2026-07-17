/**
 * Shared core logic for validating the `X-Service-Key` header, used by
 * every internal/service-to-service endpoint (Console -> Terminal gateway
 * calls under `/api/app/*`, and Terminal's own `/api/console/*` routes).
 *
 * This module is intentionally framework-agnostic (no Fastify `reply`
 * here) — each call site maps a `ServiceKeyResult` to its own existing
 * HTTP response shape, since the three call sites this consolidates
 * (`app.routes.ts`'s `serviceKeyMiddleware` and `bookingAuthMiddleware`,
 * `console.routes.ts`'s `requireServiceKey`) have subtly different
 * observable behavior (different error bodies, and console.routes.ts has
 * its own NODE_ENV-dependent dev-pass branch) that must be preserved
 * exactly.
 */

export type ServiceKeyResult =
  | { kind: 'ok' }
  | { kind: 'missing-header' }
  | { kind: 'not-configured' }
  | { kind: 'invalid' };

export function getTerminalServiceKey(): string {
  return process.env.TERMINAL_SERVICE_KEY || '';
}

/**
 * Pure decision logic, no side effects:
 *   - no header + no configured key   -> ok (nothing to check against)
 *   - no header + key configured      -> missing-header
 *   - header present + no configured key -> not-configured
 *   - header present + mismatch       -> invalid
 *   - header present + match          -> ok
 *
 * `expected` is optional — pass it explicitly when a call site reads the
 * configured key differently (a module-level const captured at import
 * time, or a `.trim()`'d value) so timing/trim semantics stay identical
 * to that call site's original behavior. Defaults to
 * `getTerminalServiceKey()` (a fresh `process.env` read) when omitted.
 */
export function evaluateServiceKey(incomingKey: string | undefined, expected?: string): ServiceKeyResult {
  const key = expected !== undefined ? expected : getTerminalServiceKey();
  if (!incomingKey) {
    return key ? { kind: 'missing-header' } : { kind: 'ok' };
  }
  if (!key) return { kind: 'not-configured' };
  if (incomingKey !== key) return { kind: 'invalid' };
  return { kind: 'ok' };
}
