# Cargo OD-Matrix Pricing — Implementation Report

Full identity-swap rewrite of cargo pricing, mirroring the passenger
OD-matrix system (`PRICING_IDENTITY_SWAP_REPORT.md`). Old flat/scope-chain
`cargo_rates` (global|pattern|trip, one row per OD, `price_per_kg` +
`price_per_leg` + `min_charge` columns, leg-count math) is **gone**.
Development codebase, no production data — full rewrite, not an additive
migration.

## 1. New model

- **`cargo_types`**: added `min_charge` (moved OFF the rate — see §2).
- **`cargo_rates`** (identity swap, same table name, new shape): OD-matrix
  per **(pattern, cargoType)**. `matrix` jsonb = `{version:1, cells:
  {"originStopId|destinationStopId": {pricePerKg}}}`, `kind` (`regular` |
  `seasonal`), `validFrom`/`validTo`, `isActive`, `updatedAt` (optimistic
  lock). Unique on `(cargo_type_id, pattern_id, kind, valid_from,
  valid_to)` where not deleted.
- **`cargo_rate_exceptions`** (new): sparse per-trip, per-cargoType,
  per-OD price override. Unique on `(trip_id, cargo_type_id,
  origin_stop_id, destination_stop_id)` where not deleted.
- **Precedence** (`resolveCargoCell`): `trip-exception > pattern seasonal
  (active window) > pattern regular > 0 ("Tarif belum diatur")`. **No
  global tier** — cargo always needs a pattern to resolve against, unlike
  passenger which keeps a `global` fallback.
- **`calculatedAmount = Math.max(pricePerKg * weightKg, minCharge)`** —
  `minCharge` now read from `cargo_types`, not the rate. All leg-count
  logic (`countLegsBetweenStops`, `pricePerLeg`, `legCost`) is deleted.

## 2. Design decisions & justification

1. **Dropped `scope`/`cargo_rate_scope` entirely** (didn't keep it as a
   constant). `cargo_rates.pattern_id` is `NOT NULL` here (unlike
   passenger's nullable `patternId` for its real `'global'` rows), so
   `scope` could only ever hold one value — a column that can never
   discriminate anything is dead weight, not documentation. Trip
   overrides live in `cargo_rate_exceptions`, not a scope value.
2. **Generalized the shared resolver helpers** in `priceRules.resolver.ts`
   (`getMatrixCellPrice`, `extractMatrixGrid`, `serializeMatrixGrid`) via
   an optional `field` parameter defaulting to `'price'`, rather than
   forking them. Every existing passenger call site is unchanged (0 args
   added); cargo passes `'pricePerKg'` explicitly. `matrixCellKey`,
   `pickFirstPriced`, `pickActiveSeasonalOrRegular` needed **zero**
   changes — already fully cell-shape-agnostic. Chose loose `Record<
   string, unknown>` typing on the blob parameter over a generic `TCell`
   threaded through a `Record<string, TCell>` position: a concrete
   non-index-signature type (`PriceRuleBlob`/`CargoRateBlob`) is awkward
   for TS to infer against that shape, and the runtime logic is a single
   dynamic-key lookup that doesn't gain much from extra generic precision.
   Verified empirically: `tests/priceRules.resolver.test.ts` (17 tests,
   passenger-only) passes unmodified.
3. **Sibling resolver** (`server/modules/cargo/cargoRates.resolver.ts`),
   not a merged one — cargo's extra cargoType dimension and total absence
   of a global tier would have made a single shared resolver function
   branchy and harder to reason about than two small resolvers sharing
   primitives.
4. **cargoRates.service.ts / cargoRates.resolver.ts hit `db` directly**,
   bypassing `cargo.repository.ts`/`storage.ts` for rates — mirrors
   `priceRules.service.ts` exactly (passenger's price-rule reads/writes
   also bypass the storage abstraction entirely). `cargo.repository.ts`
   only had the **old** flat methods (`findCargoRate` + flat CRUD)
   deleted; no new matrix methods were added there, to avoid a second,
   inconsistent access path alongside the resolver/service's direct
   `db` calls.
5. **v1 duplication** (`duplicateMatrixToCargoType`) keyed off an explicit
   `sourceMatrixId` (not a `(pattern, cargoType, kind)` re-derivation) —
   a pattern+cargoType pair can have multiple seasonal rows with
   different windows, so deriving "the" source row for `kind='seasonal'`
   would be ambiguous. Operating on a specific row id the UI already has
   open is unambiguous and works for regular or any specific seasonal
   template.
6. **Sync is per (pattern, cargoType)** — each cargoType's regular matrix
   is checked independently against the pattern's live stop list;
   `missingPairs` get `pricePerKg: 0` placeholders, matching passenger's
   sync semantics exactly (read-time detection + manual button, no
   webhooks, never overwrites a filled cell).
7. **CSO quote-tariff now sends `serviceDate`** (the trip's own date,
   already computed client-side) so seasonal windows resolve correctly;
   previously only `tripId` was sent. `calculateTariff` derives
   `patternId` (and `serviceDate` if not explicitly passed) from the trip
   when `tripId` is given — required, since scope is pattern-only:
   **without a `tripId`, there is no way to resolve a price at all now**
   (no global fallback to fall back to). This is a deliberate, disclosed
   behavior change from the old code's global-fallback path.

## 3. Files changed

**Schema**: `shared/schema/enums.ts` (dropped `cargoRateScopeEnum`, added
`cargoRateKindEnum`), `shared/schema/cargo.ts` (full rewrite).

**Server**: `server/modules/priceRules/priceRules.resolver.ts`
(generalized 3 helpers), `server/modules/cargo/cargoRates.resolver.ts`
(new), `server/modules/cargo/cargoRates.service.ts` (new),
`server/modules/cargo/cargo.service.ts` (`calculateTariff` rewrite,
`countLegsBetweenStops` deleted), `server/modules/cargo/cargo.controller.ts`
(flat handlers → matrix handlers), `server/modules/cargo/cargo.routes.ts`
(new `/api/cargo-rates/*` routes), `server/repositories/cargo.repository.ts`
(`findCargoRate` + flat CRUD deleted; `deleteCargoType` now also cleans
`cargo_rate_exceptions`), `server/storage.interface.ts` + `server/storage.ts`
(5 flat cargo-rate methods removed).

**Client**: `client/src/components/masters/CargoRatesManager.tsx` (full
rewrite mirroring `PriceRulesManager.tsx` + cargoType selector + v1
duplication UI), `client/src/components/masters/CargoTypesManager.tsx`
(+ `minCharge` field), `client/src/lib/api.ts` (`cargoRatesApi` rewritten;
`cargoApi.quoteTariff` + `serviceDate`), `client/src/pages/cargo/
CargoTerminalPage.tsx` (tariff shape drops `pricePerLeg`/`legCount`;
`quoteTariff` call now passes `serviceDate`). `trip.legCount` (an unrelated
"how many stops this trip has" field from `CargoAvailableTrip`, not a
pricing concept) was deliberately left untouched.

**Migrations**: `migrations/0016_cargo.sql` (full rewrite, create-only),
`migrations/0002_enums.sql` (enum decl swapped). As with the passenger
swap, `migrations/meta/_journal.json` and the snapshot files were
deliberately **not** touched — this repo's live-apply path for schema
changes is `npm run db:push` (schema-diff against the live DB), which does
not read the migrations folder. These SQL files exist as a historical
record only.

**Seeds**: `server/seeds/index.ts` (`cargo` step now depends on
`patterns`, gets `ctx`; added `cargo_rate_exceptions` to the cleanup
TRUNCATE list), `server/seeds/{nusa,buskita}/07-cargo.ts` (rewritten: 7
cargo types with `minCharge`, then one `cargo_rates` regular row per
(pattern × cargoType) = 56 rows per operator, using each cargo type's
per-kg rate flat across all 8 patterns — a deliberate seed simplification,
not an architectural limit; any cell can be edited per-pattern in Master
Data). `server/seeds/07-cargo.ts` (root) is **not wired into any active
seed path** (pre-existing, predates the nusa/buskita split) — updated only
enough to keep compiling (types with `minCharge`, rates block dropped
since it has no pattern context).

**Tests**: `tests/sprint2-integration.test.ts` (I9 rewritten for the new
resolver-based math + no-tripId-→-null; added I9b trip-exception-wins),
`tests/sprint2-rbac-service-guards.test.ts` (removed dead
`findCargoRate`/`getTripStopTimes` mock entries), new
`tests/cargoRates.resolver.test.ts` (13 tests: grid round-trip +
multi-city regression, `resolveCargoCell` precedence + seasonal
active/inactive, OD-aware selectability, duplication, optimistic lock).

## 4. Dev DB reset instruction

Any environment with the OLD `cargo_rates` shape already applied:

```sql
DROP TABLE IF EXISTS "cargo_rate_exceptions" CASCADE;
DROP TABLE IF EXISTS "cargo_rates" CASCADE;
```

then `npm run db:push` (drizzle-kit's interactive rename prompt would
otherwise block this identity swap from being applied non-interactively).

## 5. Verification

- `npx tsc --noEmit`: **0 new errors**. 2 pre-existing errors remain
  (`server/modules/refunds/refunds.service.ts`,
  `server/realtime/ws.ts`) — confirmed identical on the pristine
  pre-change tree via `git stash -u`, unrelated to this change.
- `npx vitest run`: **243/247 passing**. The 4 failures
  (`tests/sprint2-reschedule-chaos.test.ts`) are confirmed pre-existing
  (identical failure on the pristine tree), unrelated to cargo.
- **Passenger pricing unaffected**: `tests/priceRules.resolver.test.ts`
  (17 tests) passes unmodified against the generalized shared helpers.
- New cargo tests: `tests/cargoRates.resolver.test.ts` (13/13),
  `sprint2-integration.test.ts` I9/I9b (2/2).
- Grepped clean: `pricePerLeg`, `countLegsBetweenStops`, `findCargoRate`,
  `cargoRateScopeEnum`, cargo-related `scopeRefId` all return zero hits.

## 6. Known limitations / follow-ups

- `tests/priceRules.resolver.test.ts`'s own DB-dependent parts
  (`resolvePassengerCell`, live-Postgres concurrency test) were already
  flagged as not run in this sandbox before this change, and remain so —
  unrelated to cargo.
- Seed rates use one flat `pricePerKg` per cargo type across all 8 seeded
  patterns per operator (§3) rather than distance-scaled pricing; purely a
  seed-data realism choice, not a system limitation.
- `docs/FEATURES.md` was not updated with a cargo-pricing section (out of
  the explicit scope requested; happy to add on request).
