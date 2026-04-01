FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

# Install semua deps (termasuk dev) untuk keperluan build
# Layer ini di-cache selama package.json tidak berubah
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Copy source dan build
COPY . .
RUN npm run build

# ─────────────────────────────────────────────
# Stage production: hanya yang dibutuhkan runtime
# ─────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

# Install hanya production deps — skip vite, tsx, drizzle-kit, dll
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Hasil build
COPY --from=builder /app/dist ./dist

# Migrations dan shared diperlukan karena ada dynamic import di runtime
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

EXPOSE 5000

CMD ["node", "dist/index.js"]
