# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage production build for the clinic Next.js 16 app.
#   base    → Node 22 (alpine) + corepack/pnpm + libc6-compat for standalone
#   deps    → install locked dependencies only (best layer cache)
#   builder → prisma generate + next build (webpack; emits standalone + sw.js)
#   runner  → minimal, non-root image serving `.next/standalone/server.js`
# The repo pins neither Node nor pnpm, so both are pinned explicitly here.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS base
# libc6-compat: some Next.js standalone deps expect glibc symbols on musl.
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /app

# ── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Build ────────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* are inlined into the client bundle at build time, so they must
# be present here (not only at runtime). Pass them via `docker build --build-arg`
# or the compose `build.args` block. Server-only secrets (DATABASE_URL,
# SUPABASE_SERVICE_ROLE_KEY, WAHA_API_KEY) are injected at runtime instead.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY \
    NEXT_TELEMETRY_DISABLED=1

# Prisma client is gitignored → regenerate it, then build (webpack for Serwist).
RUN npx prisma generate \
 && pnpm build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=4000 \
    HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Standalone output already contains the traced node_modules + server.js.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 4000

# Lightweight liveness probe against the app root.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/ >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
