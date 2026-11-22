# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage production Dockerfile for Clinic Next.js 16 (Coolify, port 4000)
#   base    -> Node 22 Alpine + Corepack/pnpm@10.26.1
#   deps    -> locked dependency install with BuildKit pnpm store cache
#   builder -> prisma generate + next build --webpack (standalone + Serwist SW)
#   runner  -> minimal Node 22 Alpine, non-root, dumb-init, listening on :4000
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm" \
    PNPM_STORE_DIR="/pnpm/store" \
    PATH="/pnpm:$PATH"
RUN corepack enable \
 && corepack prepare pnpm@10.26.1 --activate
WORKDIR /app

# ── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# ── Build ────────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public variables inlined into the client bundle at build time.
# In Coolify, mark these as "Available at Buildtime" (and Runtime).
# Server-only secrets (DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.) are
# injected at runtime only and must never be baked into the image.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NODE_MAX_OLD_SPACE_SIZE=3072

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS="--max-old-space-size=${NODE_MAX_OLD_SPACE_SIZE}"

# Runs `prisma generate && next build --webpack` using the locked Prisma 7 CLI.
RUN pnpm build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# libc6-compat: compatibility layer for standalone deps on musl.
# dumb-init: proper PID 1 signal forwarding (SIGTERM) for zero-downtime rollouts.
RUN apk add --no-cache libc6-compat dumb-init \
 && addgroup -g 1001 -S nodejs \
 && adduser -u 1001 -S nextjs -G nodejs

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=4000 \
    HOSTNAME=0.0.0.0

# Standalone bundle includes traced node_modules and server.js.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 4000

# Lightweight liveness probe against /api/health (bypasses i18n/auth proxy).
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD sh -c 'wget -qO- "http://127.0.0.1:${PORT:-4000}/api/health" >/dev/null 2>&1 || exit 1'

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
