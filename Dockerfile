# ─────────────────────────────────────────────
# Stage 1: Builder — install semua deps + build
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

# Copy manifest dulu agar layer ini ter-cache selama package.json tidak berubah
COPY package.json package-lock.json ./

# Install SEMUA deps (termasuk devDependencies) untuk keperluan build:
# drizzle-kit, typescript, esbuild, tsx, dll hanya dibutuhkan di sini.
RUN npm ci

# Copy seluruh source dan jalankan build
COPY . .
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Production — image ringan, hanya runtime
# ─────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

# Install hanya production dependencies (--omit=dev).
# Catatan: vite dan @vitejs/plugin-react HARUS ada di dependencies (bukan devDependencies)
# karena esbuild mem-bundle vite.config.ts secara inline ke dist/index.js.
# Static import "@vitejs/plugin-react" di vite.config.ts di-hoist oleh ESM,
# sehingga Node.js mencarinya saat startup meskipun setupVite() tidak pernah dipanggil
# di production mode. Kedua package ini sudah dipindah ke dependencies.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Salin hasil build dari stage builder
COPY --from=builder /app/dist ./dist

EXPOSE 5000

CMD ["node", "dist/index.js"]
