# Bulk Schedule Exception — Design

## Problem

In Penjadwalan (scheduler calendar), operators can only mark a single trip
occurrence as an exception (e.g. "libur") one at a time via the trip detail
dialog. When a national holiday or blanket schedule change affects many
trips across many routes/dates, the operator has to repeat this one by one,
which is slow and error-prone.

## Goals

- Let an operator select many schedule cells across the calendar grid and
  apply one exception (with one shared reason) to all of them in a single
  action.
- Preserve the existing single-exception flow (trip detail dialog) unchanged.
- Keep a record of which exceptions were created together as a batch, for
  future auditing, without building a dedicated management UI yet.

## Non-goals (this iteration)

- Bulk "remove exception" / undo-a-whole-batch UI.
- Bulk driver/vehicle reassignment.
- A dedicated screen to browse past exception groups.

## Data model

Add a new table `schedule_exception_groups`:

| column      | type      | notes                                   |
|-------------|-----------|------------------------------------------|
| id          | uuid pk   | default gen_random_uuid()                |
| reason      | text      | required — shown as the group's label     |
| createdBy   | text      | nullable, same convention as other tables |
| createdAt   | timestamptz | default now()                           |

Add a nullable `groupId` column (FK → `schedule_exception_groups.id`) to the
existing `schedule_exceptions` table.

- Exceptions created through the existing single-item flow keep
  `groupId = null` (unchanged behavior).
- Exceptions created through the new bulk flow all reference the same,
  newly-created group row.
- Deleting an individual exception (existing `DELETE
  /api/scheduler/exceptions/:id`) is unaffected — it just removes that row.
  The group row is left in place even if all its members are eventually
  deleted; no cleanup job needed for this iteration (it's small, historical
  metadata, not a foreign-key-cascading concern).

## UX flow

### Entering select mode

- New "Pilih Jadwal" toggle button placed in the scheduler's existing
  toolbar row (the one already made responsive for mobile/tablet).
- Toggling it on enters `selectMode`; toggling off exits and clears any
  current selection.

### Selecting cells

- While `selectMode` is active, clicking a trip card (status
  `scheduled` or `virtual`) toggles it in/out of the selection set. Selected
  cards get a visible `ring-2 ring-primary` style — no checkbox.
- Clicking a card that is already an exception is a no-op (not selectable —
  no point re-excepting something already excepted).
- Clicking a trip card while in select mode does **not** open the trip
  detail dialog. To inspect a trip's detail, the operator must exit select
  mode first.
- Clicking a date column header toggles selection for every selectable
  (`scheduled`/`virtual`) card in that column — this is the fast path for
  "exclude this whole day everywhere" (e.g. national holiday).

### Bulk action bar

- While `selectMode` is active and at least one item is selected, a second
  sticky bar appears (directly below the existing filter toolbar, following
  the same sticky pattern used elsewhere on this page) showing:
  - "N dipilih"
  - "Set Pengecualian" button
  - "Batal" button (exits select mode, clears selection)

### Bulk exception dialog

- Clicking "Set Pengecualian" opens a dialog with:
  - A required reason text field (this becomes the group's `reason`).
  - A summary line, e.g. "43 jadwal akan dikecualikan."
  - Confirm / Cancel actions.
- On confirm: one request is sent to the new bulk endpoint. On success, the
  calendar query is invalidated (same cache key as today), select mode
  exits, and a success toast shows the count that was applied.

## API

### `POST /api/scheduler/exceptions/bulk`

Guarded by the same permission flag as the existing exception endpoints
(`action.trip.close`).

Request body:

```json
{
  "items": [{ "baseId": "uuid", "exceptionDate": "YYYY-MM-DD" }, ...],
  "reason": "Libur Nasional 17 Agustus"
}
```

Behavior:

1. Validate body (non-empty `items`, valid date format per item, non-empty
   `reason`) using zod, same style as the existing single-exception route.
2. In a single DB transaction:
   - Insert one row into `schedule_exception_groups` with the given reason
     and `createdBy` from the request context.
   - Insert one row per item into `schedule_exceptions` with that
     `groupId`, using the same upsert-on-conflict behavior as the existing
     single-add path (`onConflictDoNothing` keyed on `(baseId,
     exceptionDate)`), so re-submitting or racing with another exception
     creation for the same base+date is a safe no-op for that item rather
     than an error.
3. Emit the same webhook/websocket notifications the single-exception path
   emits today, once per item that was actually inserted (skip items that
   hit the conflict no-op).
4. Respond `201` with the created group id and the exception rows that were
   actually inserted (so the frontend can report how many were newly
   applied vs. already-excepted).

## Error handling

- Empty selection: "Set Pengecualian" button is disabled until at least one
  item is selected.
- Empty reason on submit: client-side validation blocks submit (same
  pattern as other forms in this codebase).
- Partial conflicts (some items already excepted by the time the request
  lands): not an error — those items are silently skipped server-side, and
  the success toast reflects the actual applied count vs. requested count
  when they differ (e.g. "40 dari 43 jadwal dikecualikan, 3 sudah
  dikecualikan sebelumnya").
- Network/permission failure: existing toast-based error pattern used
  elsewhere in `SchedulerPage.tsx`.

## Testing

- Backend: unit/integration test for the bulk endpoint covering successful
  bulk insert, partial-conflict skip behavior, and permission gate.
- Frontend: manual verification of select mode toggle, cell/column
  selection, bulk dialog submit, and cache invalidation refreshing the
  calendar — consistent with how this page has been manually verified so
  far (no existing automated frontend test suite for this page).
