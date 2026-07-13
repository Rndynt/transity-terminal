# Pricing Legacy Cleanup — Final Report

## Summary

Most of this cleanup was already done by prior sessions (the identity-swap commit and a couple of follow-ups). This pass verified each of the 6 listed leftovers against the actual current code, fixed the 3 that were genuinely still stale, and confirmed the other 3 were already correct — rather than re-doing work or guessing, each item below states what was checked and what (if anything) changed.

## Files Modified

| File | Change |
|---|---|
| `server/modules/priceRules/pricing.service.ts` | Removed dead `breakdown.pricePerLeg`/`breakdown.multiplier` fields (legacy leftovers, confirmed unread by any consumer) |
| `docs/FEATURES.md` | Rewrote §5 "Perhitungan Harga & Pricing Engine" in full — OD-matrix model, precedence, jsonb shape, updated file table (was still describing flat/per_leg mode with `basePricePerLeg`/`pricingMode` examples and pointing at the deleted `server/modules/pricing/` path) |
| `README.md` | Updated §5 TOC row wording (was "mode per_leg/flat") |
| `replit.md` | Added a clarifying parenthetical to the dev-DB-seed journal entry: the `passenger_price_matrices`/`passenger_price_exceptions` names it references were since renamed to `price_rules`/`price_rule_exceptions`; kept the rest of the entry as-is since it's an accurate historical record of an actual past migration-drift incident |
| `.agents/memory/drizzle-journal-drift.md` | Same treatment — added the rename clarification inline, kept the incident narrative intact |
| `PRICING_IDENTITY_SWAP_REPORT.md` | Added a header note marking it as a historical record, pointing to `docs/FEATURES.md` for current architecture (kept, not deleted — it's a legitimate audit trail of the rename map) |

No files were deleted or renamed in this pass (nothing left over that qualified — see below).

## 1. Duplicate/Mis-Named Module Files — verified, no change needed

`server/modules/priceRules/` has 6 files: `priceRules.service.ts`/`.controller.ts`/`.resolver.ts`/`.routes.ts` (CRUD + resolver) and `pricing.service.ts`/`.controller.ts` (fare quoting). This is **not** duplication — confirmed by reading all 5 relevant files plus grepping every consumer:

- `PricingService.quoteFare` owns fare computation for a booking, used by `server/modules/bookings/booking.helpers.ts`, `server/modules/bookings/roundTrip.service.ts`, and a dynamic import in `server/modules/app/app.service.ts`.
- `PricingController.quoteFare` serves `GET /api/pricing/quote-fare` (CSO's pre-booking quote preview), registered from `priceRules.routes.ts`.
- `PriceRulesService`/`PriceRulesController` own admin CRUD (grid save, seasonal templates, sync, trip exceptions) — a completely different responsibility (configuration vs. quoting), with its own RBAC-guarded write paths.

Both classes are actively imported and non-overlapping. No dead file, no duplicate logic. `priceRules.routes.ts` importing both controllers is the intentional, documented split.

## 2. Client API Layer — verified clean

`client/src/lib/api.ts`'s `priceRulesApi` already has zero `Matrix`/`matrix` identifiers in its method or export names (only the allowed `matrixId` parameter, a technical id field, and one explanatory comment). All 12 methods point at real, currently-registered routes:

```
GET    /api/price-rules/pattern/:patternId?kind=&matrixId=
GET    /api/price-rules/global
PUT    /api/price-rules
GET    /api/price-rules/pattern/:patternId/seasonal
POST   /api/price-rules/pattern/:patternId/seasonal
PATCH  /api/price-rules/:id/active
DELETE /api/price-rules/:id
GET    /api/price-rules/pattern/:patternId/sync-status
POST   /api/price-rules/pattern/:patternId/sync
GET    /api/pricing/trip-exceptions/:tripId
PUT    /api/pricing/trip-exceptions
DELETE /api/pricing/trip-exceptions/:id
```

All match `server/modules/priceRules/priceRules.routes.ts` exactly. The grid component is `client/src/components/masters/PriceGrid.tsx` (already renamed from `PriceMatrixGrid.tsx` in the identity-swap — the prompt said the old name "may" be kept, but the rename is more consistent with rule 3's intent, so it was left as `PriceGrid.tsx` rather than reverted).

## 3. Alternate Seed Files — verified clean

`server/seeds/05-prices.ts`, `server/seeds/buskita/05-prices.ts`, `server/seeds/nusa/05-prices.ts` all already insert into `priceRules` using the matrix shape (`scope:'pattern'`, `kind:'regular'`, `matrix:{version:1, cells:{...}}`, deriving origin/destination from `storage.getPatternStops` first/last by sequence). The only remaining `per_leg` text in these files is a code comment explaining the historical equivalence, not executable logic.

## 4. FareQuote Breakdown Cosmetic Fields — fixed

Grepped `breakdown.pricePerLeg`, `breakdown.multiplier`, `.multiplier`, `.pricePerLeg` across `client/` and `server/` — zero consumers (the only matches were `CargoRatesManager.tsx`'s unrelated cargo rate field, explicitly out of scope). Removed both fields from `FareQuote.breakdown` and its construction in `quoteFare()`. `booking.helpers.ts` stores the whole `fareQuote.breakdown` object as-is (not destructured field-by-field), so this is non-breaking.

## 5. `relations.ts` — verified clean

`priceRulesRelations` only references `priceRules.patternId` → `tripPatterns.id` (no `tripId`/`legIndex`, which don't exist on the new table). `tripsRelations` already includes `priceRuleExceptions: many(priceRuleExceptions)`, and `priceRuleExceptionsRelations` maps `priceRuleExceptions.tripId` → `trips.id`. Nothing to fix.

## 6. Documentation Cleanup — done (see Files Modified above)

`docs/FEATURES.md` §5 was the only file still actively teaching the old flat/per_leg model as current architecture — fully rewritten. `README.md`'s one-line TOC description updated. `replit.md` and `.agents/memory/drizzle-journal-drift.md` are historical incident logs (not architecture docs) that legitimately describe a real past event using the table names as they were at that time — annotated with a rename clarification rather than rewritten, so the incident record stays accurate. `PRICING_IDENTITY_SWAP_REPORT.md` marked historical rather than deleted, per the prompt's own "MAY keep them" allowance for exactly this kind of document.

## `tsc` + Test Results

- `npx tsc --noEmit -p .` — 0 errors in any pricing-related file (filtered `grep -iE "price|pricing"` on the full output: empty).
- `npx vitest run` — **229/233 passing**. The same 4 pre-existing, unrelated failures as in the prior two reports (`tests/sprint2-reschedule-chaos.test.ts`, a `PermissionDeniedError` from `reschedule.service.ts` — a file this task never touches). No new failures introduced by this cleanup pass.

## Final Grep Sweep (per VERIFICATION list)

```
basePricePerLeg (excl. cargo)                        → clean, no matches
pricingMode                                          → clean, no matches
per_leg (excl. cargo)                                → only in code comments (historical context, allowed)
passenger_price_matrices / passengerPriceMatrices /
  PassengerPriceMatrix                                → clean, no matches
priceMatrixApi / passengerPriceMatrixApi             → clean, no matches
0024_passenger_price_matrix                          → 3 matches, all in historical/journal docs
                                                         (replit.md, PRICING_IDENTITY_SWAP_REPORT.md,
                                                         .agents/memory/drizzle-journal-drift.md),
                                                         each now annotated with the current name
"Harga OD-Matrix" (menu string)                       → clean, no matches
/api/pricing/matrix (URL)                             → clean, no matches
price_rule_scope old values ['pattern','trip','leg','time'] → clean; enum is
                                                         ['global','pattern'] in shared/schema/enums.ts
```

## Manual QA Checklist

- [ ] Master Data → "Aturan Harga" opens `PriceRulesManager.tsx`, tab "Per Pola" shows the grid for a selected pattern.
- [ ] Fill a 3-city pattern's grid (JKT-BDG 95k / BDG-JOG 100k / JKT-JOG 200k), Simpan Harga persists correctly.
- [ ] Save with a stale `expectedUpdatedAt` (e.g. two tabs open) → 409 + "data sudah berubah" toast, not a silent overwrite.
- [ ] CSO quote (`GET /api/pricing/quote-fare`) returns the exact per-OD price entered above for each of the 3 pairs — not a sum or a per-leg-derived number.
- [ ] Create a seasonal template, confirm it only applies within its date window.
- [ ] Add a trip exception for one trip+OD, confirm it overrides both seasonal and regular for that trip only.
- [ ] Edit a pattern's stops, reopen the grid, confirm the sync alert/"Sync" button still detect and fill missing pairs at 0.
- [ ] A trip with at least one priced OD from the CSO's outlet stays selectable even if another OD on it is unpriced.

## Deviations From This Prompt

1. **Item 1 (module consolidation) — kept the two-service split rather than merging.** The prompt offered this as the recommended-but-optional path ("Recommended: fold... OR keep a single dedicated PricingService if intentional"). Given the clear, already-established separation of concerns (admin CRUD vs. booking-time quoting) and that merging would blur that boundary for no functional benefit, I verified non-overlap instead of merging. No dead code was found to justify a forced merge.
2. **`replit.md`/`.agents/memory/drizzle-journal-drift.md` annotated rather than rewritten.** These are historical incident logs, not architecture-explainer docs — the prompt's item 6 lists them alongside `docs/FEATURES.md`, but rewriting them to "describe only the OD-matrix model" would falsify what the drift incident actually looked like at the time it happened. Added inline clarifications instead, consistent with how the prompt itself allows `PRICING_IDENTITY_SWAP_REPORT.md` to keep old names for audit purposes.
3. **`PriceGrid.tsx` name kept as-is (not reverted to `PriceMatrixGrid.tsx`).** The prompt said the old name "may" be kept, implying it was optional either way; the current name is more consistent with rule 3's intent of minimizing "matrix" in file names, so no change was made.
