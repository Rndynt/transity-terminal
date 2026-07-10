# Bulk Close Trip — Design

> **Revision note (2026-07-10):** the original version of this doc modeled
> bulk actions around a new `schedule_exception_groups`/`schedule_exceptions`
> pair. That was wrong: the calendar's bulk select targets whole trip
> cards (not stops), and the app already has a mechanism for "this whole
> trip does not run" — `trips.status = 'closed'`, via the existing "Tutup
> Trip" flow. This revision replaces the exception-group design with a
> bulk-close design that reuses that mechanism instead of introducing a new
> exception concept. `schedule_exception_groups` and `schedule_exceptions.group_id`
> were reverted from the schema/DB.

## Problem

In Penjadwalan (scheduler calendar), operators can only close a single trip
occurrence at a time via the trip detail dialog's "Tutup Trip" button. When a
national holiday or blanket schedule change affects many trips across many
routes/dates, the operator has to repeat this one by one, which is slow and
error-prone.

## Goals

- Let an operator select many schedule cells across the calendar grid and
  close all of them (set `status = 'closed'`) in a single action, with one
  shared reason recorded for audit purposes.
- Preserve the existing single-trip "Tutup Trip" flow unchanged.
- Keep a record of why/when/by whom each trip was closed, without building a
  dedicated management UI yet.

## Non-goals (this iteration)

- Bulk re-open / undo-a-whole-batch UI.
- Bulk driver/vehicle reassignment.
- A dedicated screen to browse past closures.
- Per-stop pickup/dropoff bulk closure (that's the separate, existing
  `schedule_stop_exceptions` mechanism and is out of scope here).

## Data model

Add a lightweight audit table `trip_closures` (not an "exception" concept —
this is a log of closures, closures themselves live on `trips.status`):

| column    | type        | notes                                      |
|-----------|-------------|---------------------------------------------|
| id        | uuid pk     | default gen_random_uuid()                    |
| tripId    | uuid, FK → trips.id | required                              |
| reason    | text        | nullable — single-close still has no reason UI |
| closedBy  | text        | nullable, same convention as other tables    |
| closedAt  | timestamptz | default now()                                |

- Both the existing single "Tutup Trip" action and the new bulk action write
  through the same `TripBasesService.closeTrip(tripId, reason?, closedBy?)`,
  so every closure — solo or bulk — gets one `trip_closures` row.
- The audit insert is best-effort: if it fails, the trip is still considered
  closed (status update + hold release already happened) rather than the
  whole operation being reported as failed.

## UX flow

### Entering select mode

- "Pilih Jadwal" toggle button in the scheduler's toolbar row.
- Toggling it on enters `selectMode`; toggling off exits and clears any
  current selection.

### Selecting cells

- While `selectMode` is active, clicking a trip card (status `scheduled` or
  `virtual`) toggles it in/out of the selection set. Selected cards get a
  `ring-2 ring-primary` style — no checkbox.
- Clicking a card that is already an exception is a no-op.
- Clicking a trip card in select mode does **not** open the trip detail
  dialog.
- Clicking a date column header toggles selection for every selectable card
  in that column.

### Bulk action bar

- While `selectMode` is active and at least one item is selected, a sticky
  bar appears showing:
  - "N dipilih"
  - "Tutup Trip" button
  - "Batal" button (exits select mode, clears selection)

### Bulk close dialog

- Clicking "Tutup Trip" opens a dialog with:
  - A required reason text field.
  - A summary line, e.g. "43 jadwal akan ditutup (virtual akan diaktifkan
    lalu ditutup)."
  - Confirm / Cancel actions.
- On confirm: one request is sent to the bulk endpoint. On success, the
  calendar query is invalidated, select mode exits, and a toast shows the
  closed/failed counts.

## API

### `POST /api/trips/close-bulk`

Guarded by the same permission flag as the existing close endpoint
(`action.trip.close`).

Request body:

```json
{
  "items": [
    { "tripId": "uuid" },
    { "baseId": "uuid", "serviceDate": "YYYY-MM-DD" }
  ],
  "reason": "Libur Nasional 17 Agustus"
}
```

Each item identifies a calendar slot either by an already-materialized
`tripId`, or by `baseId` + `serviceDate` for a virtual slot (materialized
on the fly before closing).

Behavior:

1. Validate body (non-empty `items`, each item has `tripId` XOR
   `baseId`+`serviceDate`, non-empty `reason`) using zod.
2. Process items sequentially: materialize virtual items via the existing
   `ensureMaterializedTrip`, then close via the existing
   `TripBasesService.closeTrip` (status update, hold release, audit log,
   websocket/webhook notification — all unchanged from the single-close
   path).
3. Each item succeeds or fails independently; one item's failure (e.g.
   trip base not eligible, already closed) does not abort the batch.
4. Respond `200` with per-item results:

```json
{
  "ok": true,
  "requested": 2,
  "closed": 1,
  "failed": 1,
  "succeeded": [{ "item": { "tripId": "..." }, "tripId": "...", "status": "closed" }],
  "errors": [{ "item": { "baseId": "...", "serviceDate": "..." }, "error": "..." }]
}
```

## Error handling

- Empty selection: "Tutup Trip" button is disabled until at least one item
  is selected.
- Empty reason on submit: client-side validation blocks submit.
- Per-item failures (e.g. base not eligible for that date, trip already
  closed) are reported back in `errors` with the original item attached, so
  the client/operator can tell exactly which selection failed and why — the
  batch as a whole still returns `200`.
- Network/permission failure: existing toast-based error pattern used
  elsewhere in `SchedulerPage.tsx`.

## Testing

- Backend: integration test for the bulk endpoint covering successful bulk
  close (mix of already-materialized and virtual items), partial-failure
  reporting, and the permission gate.
- Frontend: manual verification of select mode toggle, cell/column
  selection, bulk dialog submit, and cache invalidation refreshing the
  calendar — consistent with how this page has been manually verified so
  far (no existing automated frontend test suite for this page).
