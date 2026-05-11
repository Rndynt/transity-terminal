# Audit S2-09 — Payment Webhook Idempotency + HMAC

**Sprint**: 2 / S2-09
**Files**:
- `server/modules/app/app.controller.ts:341-378` (`paymentWebhook` handler).
- `server/modules/app/app.service.ts:1107-1230` (`processPaymentWebhook` impl).
- `server/index.ts:104-110` (rawBody capture parser).

## Ringkasan flow

1. Handler load `PAYMENT_WEBHOOK_SECRET` env var. Kalau tidak set → 503.
2. Baca header `x-webhook-signature` (hex string).
3. Compute expected HMAC-SHA256(rawBody, secret) → hex.
4. Length check: `signature.length !== expectedSig.length` → 401 sebelum
   `timingSafeEqual` (kalau langsung timingSafeEqual dengan length berbeda
   → throw exception).
5. `crypto.timingSafeEqual(Buffer.from(signature, 'hex'),
   Buffer.from(expectedSig, 'hex'))` → konstan-waktu compare.
6. Validasi payload: `providerRef`, `status` IN ('success', 'failed').
7. Forward ke `processPaymentWebhook(providerRef, gatewayStatus)`.
8. **[BARU S2-09]** Service replay-safe: kalau `payment.status !==
   'pending'`, return 200 idempotent (bukan throw 400).

## Findings

### F1 — [PASS] HMAC verification konstan-waktu

`crypto.timingSafeEqual` dipakai dengan length-pre-check. Aman dari
timing attack. Verifikasi: `tests/sprint2.test.ts > Payment webhook HMAC
> "crypto.timingSafeEqual dipakai..."`.

Subtle: kedua buffer di-decode dari hex (bukan utf8). Kalau attacker
kirim signature dengan karakter non-hex, `Buffer.from(s, 'hex')` akan
silently potong sampai char invalid pertama → length berbeda → 401 di
length check. Tetap aman.

### F2 — [PASS] Raw body capture untuk signature

`server/index.ts` register custom contentTypeParser:
```ts
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, ...)
```
yang menyimpan buffer original ke `req.rawBody`. Tanpa ini, Fastify
parse JSON terus re-stringify → byte tidak persis sama dengan yang
gateway sign → signature mismatch terus.

### F3 — [FIXED] Replay event return 400 (gateway anggap kita gagal)

**Sebelum**: kalau gateway re-deliver event sukses (network blip atau
manual replay dari dashboard), `processPaymentWebhook` throw
"Payment already processed" → 400. Gateway treat sebagai integration
broken setelah N retry → matikan webhook → kita kehilangan event masa
depan.

**Sesudah**: kalau payment sudah processed (status non-pending), return
200 dengan `{status, bookingId, idempotent: true}`. Gateway happy,
tidak ada side-effect (tidak masuk ke confirm/cancel transaction).
`payment.status` adalah sumber kebenaran final — tidak akan ter-flip
oleh replay.

### F4 — [PASS] No double-credit pada replay

Karena replay langsung return tanpa masuk transaction, tidak ada path
ke INSERT payments lagi, tidak ada UPDATE bookings lagi, tidak ada
emit WebSocket lagi. Side-effect = 0.

Untuk path yang LAMBAT (event original masih in-flight saat replay
arrive paralel), guard `WHERE booking.status='pending'` di line 1131
dan `payments.status='pending'` di SELECT akan menjaga. Status guard
di confirm path sudah audit di S2-01.

### F5 — [PASS] Constant-time signature failure path

Length-pre-check sebelum `timingSafeEqual`:
```ts
if (signature.length !== expectedSig.length || !timingSafeEqual(...)) {
  reply.code(401)...;
}
```
Length check necessary karena `timingSafeEqual` throw `RangeError`
kalau buffer length tidak sama. Length itself **bocor** kalau
attacker bisa mengukur — tapi expected length deterministik
(SHA-256 hex = 64 char), jadi bukan info baru bagi attacker. Tidak
ada kebocoran tambahan.

### F6 — [INFO] Tidak ada event-id idempotency table

Sistem sekarang dedupe by `providerRef + payment.status`. Kalau
gateway kirim event berbeda untuk `providerRef` yang sama (mis.
'success' kemudian 'refunded'), keduanya akan diproses (yang kedua
akan kena status guard kalau payment sudah 'success').

Untuk gateway yang punya event-id (Midtrans, Xendit, Stripe), best
practice tambah tabel `payment_webhook_events` (event_id PK, processed_at)
untuk dedupe by event-id. **Tidak diimplement di S2-09** — gateway
bervariasi per operator dan replay-safety F3 sudah cover skenario
"same event, multiple delivery". Future enhancement.

## Test coverage S2-09

`tests/sprint2.test.ts > AppService.processPaymentWebhook`:
1. Replay 'success' event → return 200 idempotent.
2. Replay 'failed' event → return 200 idempotent.
3. providerRef tidak ada → throw "Payment not found" (bukan replay).

`tests/sprint2.test.ts > Payment webhook HMAC`:
1. Source code grep memastikan `crypto.timingSafeEqual` dan length
   pre-check tetap ada (regression guard kalau di-refactor).

## Acceptance roadmap

> replay event tidak double-credit; timing attack resisted

- [x] **replay event tidak double-credit**: F3 + F4 + tests "replay
      event sudah success/failed".
- [x] **timing attack resisted**: F1 + F5 + test "crypto.timingSafeEqual
      dipakai".
