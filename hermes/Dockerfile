# ─────────────────────────────────────────────────────────────────────────────
# HERMES — Dockerfile (Fase 0)
# Multi-stage: deps → build → runtime (imagem final enxuta).
#
# Node 22 LTS (não 20): @supabase/supabase-js >= 2.106 exige WebSocket nativo
# (Node 22+). Decisão registrada no RELATORIO-FASE-0.md.
# ─────────────────────────────────────────────────────────────────────────────

# ── Estágio 1: dependências (completas, para o build) ────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Estágio 2: build (TypeScript → dist) ─────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Estágio 3: runtime ────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server.js"]
