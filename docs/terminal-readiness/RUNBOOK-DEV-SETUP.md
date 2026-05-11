# Dev Setup — TransityTerminal

**Audience:** developer baru / fresh checkout di mesin.

---

## 1. Prereq

- Node.js 20.x (cocok dengan `package.json` engines)
- pnpm 10.x atau npm 10.x
- Postgres 16 lokal (atau pakai Replit-managed DB)
- Git 2.x

---

## 2. Install dependencies

```bash
npm ci   # atau: pnpm install --frozen-lockfile
```

---

## 3. Aktivasi pre-commit hook (S3-02)

Husky v9+ tidak auto-install lewat `npm install` kalau `prepare` script
belum ditambahkan ke `package.json` (skill main agent tidak boleh edit
package.json — tunggu approval owner repo). Sebagai workaround, dev
baru jalankan SATU KALI:

```bash
npx husky
```

Command ini akan:
- Set `git config core.hooksPath .husky`
- Membuat folder `.husky/_/` (helper husky internal)

Setelah itu, hook `.husky/pre-commit` akan jalan otomatis di setiap
`git commit`. Hook menjalankan:

1. `lint-staged` — cek file yang di-stage saja (cepat).
2. `tsc --noEmit` — typecheck full (lambat tapi aman). Comment kalau
   terlalu lambat di project lokal.

Bypass (sparingly):

```bash
git commit --no-verify -m "..."
```

---

## 4. Env vars (minimum dev)

Salin `.env.example` (kalau ada) atau buat `.env` minimum:

```bash
DATABASE_URL=postgres://...
JWT_SECRET=$(openssl rand -hex 32)
DEV_BYPASS_AUTH=true   # WAJIB false di production (boot guard tolak)
NODE_ENV=development
```

Optional (S3-03 + Sentry):
- `SENTRY_DSN=https://...@sentry.io/...` (kalau diset, init Sentry)
- `SENTRY_TRACES_SAMPLE_RATE=0.05`

Optional (S3-08 blue/green):
- `RUN_MIGRATIONS_ON_BOOT=false` (kalau migrasi dijalankan via
  `scripts/db-migrate.ts` terpisah)

---

## 5. Run

```bash
npm run dev   # tsx server/index.ts + Vite middleware (port 5000)
```

Smoke check:

```bash
curl http://localhost:5000/api/health/clock
# expect: {"status":"ok",...}
```

---

## 6. Test

```bash
npx vitest run                       # semua test (sprint1+sprint2 = 42)
npx vitest run tests/sprint2.test.ts # subset
```

---

## 7. Tambah `prepare` script (untuk owner repo)

Saat ini Husky butuh manual `npx husky` per fresh checkout. Untuk
otomatisasi, owner repo (yang punya akses edit `package.json` di luar
agent flow) tambahkan:

```json
{
  "scripts": {
    "prepare": "husky"
  }
}
```

Setelah itu, `npm install` akan auto-install Husky hook tanpa langkah
manual. Sampai itu terjadi, dev baru harus inget jalankan `npx husky`
sekali (lihat step 3).

---

## 8. CI

Pipeline GitHub Actions di `.github/workflows/ci.yml` (S3-01):
- typecheck (continue-on-error sementara — lihat project task #7)
- vitest run (semua test)
- npm audit high
- lint placeholder (eslint config menunggu setup)

Pipeline jalan di setiap push/PR ke main/master/feat-/fix-.
