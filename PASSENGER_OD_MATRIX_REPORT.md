# Passenger OD-Matrix Implementation Report

## 1. Summary of Files Added/Modified

### Added
| File | Purpose |
|---|---|
| `shared/schema/pricing.ts` | `passenger_price_matrices`, `passenger_price_exceptions` tables, insert schemas, types, `PassengerPriceMatrixBlob` |
| `migrations/0024_passenger_price_matrix.sql` | Raw SQL migration (enums + 2 tables + indexes), audit-trail record; actual apply is via `npm run db:push` |
| `server/modules/pricing/priceMatrix.resolver.ts` | Domain-agnostic resolver: cell lookup, precedence walk, matrix<->grid conversion, seasonal window picker, passenger-specific fetch/resolve |
| `server/modules/pricing/priceMatrix.service.ts` | CRUD service: grid get/save with optimistic lock, seasonal templates, trip exceptions, sync status/apply |
| `server/modules/pricing/priceMatrix.controller.ts` | Fastify HTTP handlers |
| `server/modules/pricing/priceMatrix.routes.ts` | Route registration |
| `client/src/components/masters/PriceMatrixGrid.tsx` | Generic upper-triangular OD grid component (`renderCell` prop for reuse) |
| `client/src/components/masters/PassengerPriceMatrixManager.tsx` | Master UI: pattern grid, global fallback list, seasonal templates, trip exceptions, sync alert |
| `tests/priceMatrix.resolver.test.ts` | 17 unit tests on the pure resolver logic |

### Modified
| File | Change |
|---|---|
| `shared/schema/enums.ts` | + `passenger_matrix_scope`, `passenger_matrix_kind` enums |
| `shared/schema/index.ts` | Export `./pricing` |
| `server/routes.ts` | Register `registerPriceMatrixRoutes` |
| `server/modules/pricing/pricing.service.ts` | `quoteFare` rewritten around `resolvePassengerCell`, legacy flat/per_leg kept only as pre-migration fallback |
| `server/modules/app/app.service.ts` | `searchVirtualTrips` fare block now calls the resolver; also fixed 2 pre-existing TS type errors found while running full `tsc` (`Set<string>` narrowing in the Bug-C dedup fix from a prior session) |
| `server/lib/scheduleSnapshot.ts` | `resolveFarePerPerson` + `resolveFaresForTrips` rewritten around the resolver (primary OD = trip's first→last stop), legacy reader extracted as `legacyFarePerPerson` |
| `server/repositories/scheduling.repository.ts` | `getCsoAvailableTrips`: OD-aware `hasPriceRule` post-pass (upgrades legacy false→true when the matrix has ≥1 priced destination from the CSO's outlet) |
| `client/src/lib/api.ts` | + `passengerPriceMatrixApi` |
| `client/src/pages/masters/MastersPage.tsx` | + "Harga OD-Matrix" tab |
| `package.json` | + `"test": "vitest run"` script |

## 2. Data Model + Precedence

```
tripPatterns ──< passenger_price_matrices (scope: global | pattern)
                     kind: regular | seasonal (seasonal has valid_from/valid_to)
                     matrix jsonb: { version:1, cells: { "originStopId|destStopId": {price} } }

trips ──< passenger_price_exceptions (per-trip, per-OD, sparse row override)
```

Precedence at resolve time: **trip exception → pattern (active seasonal window, else regular) → global → 0** ("harga belum diset"). Empty/missing cell and stored price `0` are both treated as "not set."

## 3. Migration

`migrations/0024_passenger_price_matrix.sql` — creates `passenger_matrix_scope`/`passenger_matrix_kind` enums and the two tables + their unique/lookup indexes. This repo's live-apply path is `npm run db:push` (schema-diff, not the migrations folder — confirmed from `drizzle.config.ts`/`package.json`); the SQL file is the audit-trail record per project convention (same pattern as `0023_cargo_destination_outlet.sql`). **Action needed on your end**: run `npm run db:push` against the real `DATABASE_URL` to actually create these tables — I could not do this from the sandbox (no live DB connection here).

## 4. Consumer Parity — Before/After

**`pricing.service.ts` (`quoteFare`, CSO quote)**
- Before: `rules[0]`, flat = whole-pattern-one-price, per_leg = `legCount × basePricePerLeg` (linear, couldn't express independent OD prices).
- After: maps `originSeq/destinationSeq` → `stopId` via `getTripStopTimes`, calls `resolvePassengerCell({patternId, tripId, originStopId, destinationStopId, serviceDate})`. Falls back to the old flat/per_leg reader (`legacyQuoteFare`) **only** when `matrixSystemHasAnyData(patternId)` is false (i.e. nothing has been configured in the matrix system yet for this pattern or globally).

**`app.service.ts` (`searchVirtualTrips`, ~L819)**
- Before: inline copy of the same flat/per_leg arithmetic per candidate virtual trip.
- After: `resolvePassengerCell(...)` per candidate (no `tripId` — virtual), with the same `matrixSystemHasAnyData` gated fallback, cached per pattern to avoid redundant existence checks across many candidates on the same search.

**`scheduleSnapshot.ts` (`resolveFarePerPerson` / `resolveFaresForTrips`)**
- Before: read `price_rules` directly, `extractFareFromRule`.
- After: "primary OD" = trip's first stop → last stop (matches prior "per person" semantics for a whole-trip webhook snapshot), resolved via the shared resolver; legacy reader (`legacyFarePerPerson`) kept as the same pre-migration fallback. `resolveFaresForTrips` (batch variant) does the equivalent with a single batched `trip_stop_times` fetch instead of N queries. **Note**: this batch function has no callers anywhere in the codebase currently (dead code, confirmed via repo-wide grep) — refactored for consistency per the prompt, but low real-world impact.

All three now go through the exact same `resolvePassengerCell`, so a given `(patternId/tripId, originStopId, destinationStopId, serviceDate)` returns the identical price everywhere — verified by construction (single shared function), not by a live cross-service integration test (see §7 limitations).

## 5. OD-Aware `hasPriceRule` (§6)

`scheduling.repository.ts: getCsoAvailableTrips` now does a post-pass: for each unique `patternId` among the returned real+virtual trips, it fetches that pattern's stops, finds the CSO's outlet stop, computes candidate destination `stopId`s after it, and calls `hasAnyPricedDestinationFromOrigin`. If true, it **upgrades** `hasPriceRule` to `true` (never downgrades an existing legacy `true`) — so a trip stays selectable as soon as *either* the legacy rule or the matrix has at least one priced destination from that outlet.

**Deviation**: I did not implement the fine-grained "block only the specific 0-priced OD in `RouteTimeline.tsx`'s Turun button" — I added the trip-card-level OD-aware gate (server) but left the individual-destination visual disabling as a follow-up (see §7). The booking-time hard backstop (`NO_PRICE_RULE` → existing "Belum Ada Harga" toast, unchanged mapping in `pricing.controller.ts` / `booking.helpers.ts`) still fully protects against actually booking a 0-priced OD; what's missing is only the *earlier* visual hint on that one button.

## 6. Test Results

Ran in-sandbox with a dummy `DATABASE_URL` (no live Postgres available here — see §7):

```
npx vitest run tests/priceMatrix.resolver.test.ts
 ✓ tests/priceMatrix.resolver.test.ts (17 tests) 8ms
```

Covers: `matrixCellKey`/`getMatrixCellPrice` (missing cell→0, null blob→0, stored-0→0, real value), **JKT-BDG-JOG independent, non-additive pricing** (95k / 100k / 200k, explicitly asserts `200000 !== 95000+100000`), `pickFirstPriced` precedence (trip > pattern > global > none), `pickActiveSeasonalOrRegular` seasonal date-window selection (inside window, outside → regular fallback, inclusive boundaries, no-regular-row case), and `extractMatrixGrid`/`serializeMatrixGrid` round-trip (upper-triangular shape, zero-cell omission, edit→save→reload consistency).

Also ran the **full existing suite** (234 tests) to check for regressions from touching `app.service.ts`/`scheduling.repository.ts`/`scheduleSnapshot.ts`: **230 passed**, 4 failed in `tests/sprint2-reschedule-chaos.test.ts` — confirmed **pre-existing and unrelated**: `git diff`/`git log` show `reschedule.service.ts` wasn't touched in this task (last changed in an earlier, separate session), and the failure is a `PermissionDeniedError` from `rbac.guard.ts` unrelated to pricing. Flagging it here for visibility, not claiming it as fixed or caused by this work.

## 7. Deviations & Known Limitations

- **Trip-exception editor uses `tripsApi.getAll()`** (all trips, client-filtered by `patternId`) rather than a dedicated "trips for this pattern" endpoint — fine at current data volumes, would want a server-side filter param if the trips table grows large.
- **Global-tier UI is a flat add/remove row list**, not the same grid component as the pattern tier — there's no single pattern's stop-sequence to build a grid against at the global scope (no fixed stop set), so a grid didn't fit; documented as an intentional shape difference, not an oversight.
- **RouteTimeline per-destination 0-price visual disabling not implemented** (§5 deviation above) — `listPricedDestinationsFromOrigin` exists server-side and is routed (`GET /api/pricing/priced-destinations`) ready for this, just not wired into the CSO stop-picker UI yet.
- **DB-dependent tests not run**: `resolvePassengerCell`/`hasAnyPricedDestinationFromOrigin` integration, the three consumers returning identical prices against a real trip, and the two-concurrent-saves→409 test all need a live Postgres connection this sandbox doesn't have. The pure-logic layer they're built on (precedence, cell lookup, seasonal window, grid round-trip) is unit-tested and passing; the DB-integration layer is straightforward CRUD + `WHERE` clauses reviewed by hand but not executed against real data.
- **Legacy `price_rules` fallback removal**: not done — by design, kept until you've backfilled matrices for all patterns currently relying on flat/per_leg. Once every pattern has a matrix row, `matrixSystemHasAnyData` will always be true and the legacy branches become dead code you can delete.
- **JSONB-analytics limitation**: cells living inside a jsonb blob means you can't easily `GROUP BY`/aggregate across OD pairs in SQL (e.g. "average fare per km across all patterns") without unnesting the JSON first. Fine for the current CRUD/lookup use case; would need a denormalized reporting table if OD-level analytics become a real need later.
- **Seasonal template "duplicate from regular"** only copies matrix cells, not `validFrom`/`validTo`/`name` (those are seasonal-specific by definition) — noting so it's not mistaken for a bug.

## 8. Manual QA Checklist

- [ ] Create a pattern matrix (regular) for a 3-city pattern, fill JKT-BDG / BDG-JOG / JKT-JOG independently, confirm CSO quote for each OD matches exactly what was entered (not a sum/multiple).
- [ ] Leave one OD cell at 0/empty, confirm CSO gets "Belum Ada Harga" (`NO_PRICE_RULE`) only for that specific OD, and the trip itself stays selectable if any other OD is priced.
- [ ] Create a seasonal template ("Tarif Lebaran 2026") with a date window, set a different price for one OD, confirm a booking dated inside the window quotes the seasonal price and outside it quotes regular.
- [ ] Add a trip exception for one specific trip+OD, confirm it overrides both the seasonal and regular matrix for that trip only.
- [ ] Edit a pattern's stops (add/remove a stop via "Muat Halte dari Pola Rute"/bulk-replace), reopen the matrix editor, confirm the sync alert shows the right missing-pair count, click Sync, confirm new pairs appear at price 0 and existing filled cells are untouched.
- [ ] Open the same matrix in two tabs, save in one, then try saving a stale edit in the other — confirm HTTP 409 + the "data sudah berubah" toast, not a silent overwrite.
- [ ] Confirm a pattern with NO matrix configured at all still quotes via the old flat/per_leg `price_rules` exactly as before this change (regression check).

## 9. Ready for Cargo Reuse (Prompt #2)

Domain-agnostic and untouched by passenger-specific logic, ready to be called against cargo's own tables:
- `matrixCellKey`, `getMatrixCellPrice`, `pickFirstPriced`, `pickActiveSeasonalOrRegular` — pure functions, zero passenger coupling.
- `extractMatrixGrid` / `serializeMatrixGrid` — generic over any `{stopId, stopSequence, stop?}` row shape.
- `PriceMatrixGrid.tsx` — generic via `renderCell`/typed `MatrixGridCellData<T>`, cargo can plug in a different cell editor (e.g. weight tiers) without forking.

Cargo-specific work still needed next: its own `cargo_price_matrices`/`cargo_price_exceptions` tables (same JSONB shape), a `resolveCargoCell` sibling to `resolvePassengerCell` (same precedence-walk pattern, different fetch functions), and wiring `PriceMatrixGrid` into a cargo master page with its own cell renderer.
