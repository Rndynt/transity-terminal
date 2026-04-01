FROM node:20-alpine AS base
WORKDIR /app

# Layer 1: Install SEMUA deps (dev + prod) untuk keperluan build
# Layer ini hanya rebuild jika package.json / package-lock.json berubah
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Layer 2: Build frontend (Vite) dan backend (esbuild)
FROM deps AS builder
COPY . .
RUN npm run build

# Layer 3: Install hanya production deps untuk image final
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Layer 4: Image final — sekecil mungkin
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 5000

CMD ["npm", "start"]
