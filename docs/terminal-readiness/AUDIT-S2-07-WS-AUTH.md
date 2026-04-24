# Audit S2-07 — WebSocket Room Subscribe Permission

**Sprint**: 2 / S2-07
**Files**:
- `server/realtime/ws.ts` (handshake middleware + per-room guard).
- `tests/sprint2-ws.test.ts` (6 integration tests).

## Sebelum

Socket.io connection terbuka tanpa auth. `subscribe-trip`, `subscribe-base`,
`subscribe-cso` accept string apa pun — tidak ada validasi siapa yang boleh
dengar room mana. Konsekuensi:

- Attacker bisa connect WS → `subscribe-cso outletId date` → menerima
  semua `INVENTORY_UPDATED` / `STOP_EXCEPTION_CHANGED` real-time outlet
  competitor (kebocoran data ops).
- `subscribe-base baseId` → bocor `TRIP_MATERIALIZED` schedule operator
  sebelum dipublish.
- Tidak ada rate-limit / validasi input — `subscribe-trip ""` join room
  `trip:` (empty), tidak harm tapi pollute log.

## Sesudah (S2-07)

### Handshake middleware (`io.use`)

Authenticate sekali pas connect; hasil disimpan di `socket.data.kind`:

| auth payload                  | kind         | next                     |
| ---                           | ---          | ---                      |
| `{ serviceKey: <expected> }`  | `service`    | OK                       |
| `{ serviceKey: <wrong> }`     | —            | REJECT handshake (Error) |
| `{ token: <valid JWT> }`      | `app-user`   | OK + payload disimpan    |
| `{ token: <invalid JWT> }`    | —            | REJECT handshake (Error) |
| `{}` (tidak ada auth)         | `anonymous`  | OK (untuk seatmap publik) |

Catatan: kalau `TERMINAL_SERVICE_KEY` env var tidak diset di server,
serviceKey path treat sebagai anonymous (bukan reject) — supaya dev env
tanpa secret tetap bisa jalan. Production ops wajib set
`TERMINAL_SERVICE_KEY` + `STRICT_WS_AUTH=1`.

### Per-room subscribe guard

| Event              | Required kind                  | Anonymous allowed? |
| ---                | ---                            | ---                |
| `subscribe-trip`   | semua (publik seatmap)         | ✅                 |
| `subscribe-base`   | `service` (di STRICT mode)     | ❌ (STRICT)        |
| `subscribe-cso`    | `service` (di STRICT mode)     | ❌ (STRICT)        |

Kalau ditolak, server emit `subscribe-error: { room, reason }` ke client
(socket tidak di-disconnect — biar client lain di socket sama tetap
hidup). Server log `Client X DENIED subscribe to Y: reason`.

Input validation: `tripId/baseId` harus string non-empty,
`outletId/serviceDate` keduanya string non-empty. Invalid → reason
'invalid …'.

### Backward compat (`STRICT_WS_AUTH`)

Operator UI lama (`client/src/pages/cargo/CargoTerminalPage.tsx`,
`client/src/components/cso/TripSelector.tsx`) panggil
`subscribe-base` / `subscribe-cso` tanpa serviceKey. Kalau langsung
strict, UI break.

Solusi: `STRICT_WS_AUTH` env var:
- **default off** (legacy compat) → anonymous boleh subscribe-base/cso,
  tapi log warning `[STRICT_WS_AUTH=warn] Client X subscribed to Y
  without service auth`. Memungkinkan ops baca log untuk audit klien
  mana saja yang masih anonymous sebelum hardening.
- **`STRICT_WS_AUTH=1`** (production) → anonymous DITOLAK. Operator UI
  harus pass `serviceKey` di handshake (TODO Sprint 3 / dependency:
  Console BE proxy WS dengan service key, bukan langsung dari browser).

## Test coverage

`tests/sprint2-ws.test.ts` (6 test, STRICT_WS_AUTH=1):

1. Service-key salah → handshake REJECT (Error event).
2. Anonymous → connect OK, subscribe-trip OK, subscribe-base DENIED
   (`subscribe-error` dengan reason "service auth required").
3. Anonymous → subscribe-cso DENIED.
4. App-user JWT valid → connect OK, subscribe-base TETAP DENIED (JWT
   tidak elevate ke service privilege).
5. Service-key valid → subscribe-base & subscribe-cso OK (no
   subscribe-error).
6. Invalid input (empty tripId) → DENIED dengan reason "invalid".

## Acceptance roadmap

> client tanpa permission → reject join

- [x] **reject join**: implemented via `subscribe-error` emit + early
      return. Verified test #2 #3 #4.
- [x] **anonymous restricted**: STRICT mode tolak, legacy mode warn.
- [x] **service-key path**: trusted backend bisa connect + subscribe ke
      semua room. Verified test #5.
- [x] **handshake reject**: invalid service-key / token → connect_error
      di client. Verified test #1.

## Future hardening

- F1: app-user dengan booking di `tripId` X boleh subscribe-trip:X dan
  TIDAK ada batas. Ke depan, kalau seatmap mau private (operator
  tertentu), perlu lookup booking.userId match req.appUser.userId.
- F2: tidak ada rate-limit subscribe (bisa flood join 1000 room).
  Defer ke S3 (tambah counter `subscribe count > 50 / 10s` → kick).
- F3: operator UI Console belum pass serviceKey. Ke depan: Console BE
  proxy WS connection (browser → Console BE → terminal), inject
  serviceKey di server-side. Lalu set `STRICT_WS_AUTH=1` production.
