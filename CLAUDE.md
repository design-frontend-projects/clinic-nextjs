# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (see `pnpm-lock.yaml` / `node_modules/.pnpm`).

```bash
pnpm dev            # Next.js dev server on http://localhost:4000 (note: port 4000, not 3000)
pnpm build          # Production build
pnpm start          # Serve production build
pnpm lint           # ESLint (eslint.config.mjs, extends next/core-web-vitals + next/typescript)

npx prisma generate # Regenerate Prisma client after editing prisma/schema.prisma

npx vitest run                                   # Run all tests
npx vitest run src/features/rbac/__tests__/rbac.test.ts   # Run a single test file
npx vitest                                       # Watch mode
```

There is currently one test suite (`src/features/rbac/__tests__/rbac.test.ts`). Vitest is configured via defaults — no `vitest.config.ts`. Tests mock the Prisma repository and cache, so they run without a database.

## Environment

Required env vars (no `.env.example` committed — create `.env` locally):
- `DATABASE_URL` — Postgres connection string (consumed by `src/lib/prisma.ts` via the `pg` Pool + `@prisma/adapter-pg`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client (browser + SSR auth)
- `SUPABASE_SERVICE_ROLE_KEY` — server-only admin client (`createSupabaseServerClient`), used for privileged operations like creating patient auth accounts

## Architecture

Multi-tenant clinic/pharmacy management SaaS. **Next.js 16 App Router, React 19, TypeScript (strict), Tailwind v4, shadcn/ui (Radix).** The `@/*` path alias maps to `src/*`.

### Multi-tenancy (the central invariant)
A **tenant is a clinic**. Almost every table carries `clinic_id` / `tenant_id` (a clinic UUID). **Every data-access path must be scoped to the current tenant.** The canonical pattern in server actions:

```ts
const tenant = await requireTenantInfo();   // throws if no clinic context
await prisma.patients.findMany({ where: { clinic_id: tenant.clinicId, ... } });
```

`src/lib/auth.ts` is the tenant-resolution hub:
- `getSupabaseSession()` — reads the Supabase session from cookies (server-side).
- `getTenantInfo()` — resolves session → `profiles` row → `clinics` row, returning `{ profileId, role, clinicId, subscriptionPlan, branchId, ... }`. `branchId` comes from the `active_branch_id` cookie.
- `requireAuthenticatedTenant()` — throws if no profile.
- `requireTenantInfo()` — throws if no `clinicId`; use this in any action that touches tenant data.

Note: auth was migrated from Clerk to Supabase; some comments/naming still reference the legacy model (`orgId` is always `null`).

### Data layer
- **Prisma 7** with the driver-adapter setup (`PrismaPg` over a `pg` Pool) in `src/lib/prisma.ts`, exported as a hot-reload-safe global singleton `prisma`.
- `prisma/schema.prisma` is the source of truth. Table/column names are **snake_case**, and Prisma model accessors are the snake_case plural table names (e.g. `prisma.medical_records`, `prisma.user_roles`).
- **Migrations are raw SQL** in `prisma/migrations/*.sql` (RBAC tables, Supabase RLS policies + helper functions like `auth.current_tenant_id()`, seed data, an `on_auth_user_created` trigger) — applied manually to Supabase, **not** via `prisma migrate`. RLS is the defense-in-depth layer beneath the app-level tenant scoping.
- `src/generated/prisma/` exists but the app imports the client from `@prisma/client`.

### RBAC (`src/features/rbac/`)
A custom, hierarchical, deny-by-default permission engine — the most complex subsystem. Layered as **domain → repositories → services**:
- `services/evaluation.service.ts` — `evaluatePermission()` resolves in strict priority order: tenant-permission whitelist → direct explicit **deny** → role explicit deny (incl. inherited) → direct explicit **allow** → role allow (direct or inherited) → **default deny**. Supports wildcard/module matching (`patient.manage` and `patient.*` both grant `patient.read`; `manage`/`*` grant everything) and role inheritance via BFS over `role_hierarchy`.
- `services/rbac.service.ts` — role/permission CRUD; wraps multi-step writes in transactions, invalidates cache, and writes audit logs on every mutation.
- `services/cache.service.ts` — in-memory TTL cache (per server process) for permissions/roles/hierarchy, plus React `cache()` request-dedup. Not distributed — do not assume it survives across instances.
- `src/lib/rbac.ts` — the thin entry point app code should use: `hasPermission(name)`, `getUserPermissions()`, `getUserRoles()`. `"Super Admin"` short-circuits to allow-all.

### Server Actions are the API
There is **no REST/route-handler API** for data (only `src/app/auth/callback/route.ts` for the Supabase OAuth code exchange). All mutations/queries live in `src/app/actions/*.ts` (`admin`, `doctor`, `staff`, `clinic`, `tenant`, `rbac`, `profile`, `onboarding`, `personnel`, `app-owner`), each marked `"use server"`. Conventions: call `requireTenantInfo()` first, validate input with Zod (`src/types/*.types.ts`), mutate via `prisma`, then `revalidatePath()`. Actions typically return either the data or `{ error: string }` / `{ success: true }` rather than throwing to the client.

### Routing, i18n, and layouts
- **All routes are localized** under `src/app/[locale]/`. `next-intl` (`src/i18n/routing.ts`) defines locales `en` and `ar` (default `en`); messages live in `src/messages/{en,ar}.json`. `next.config.ts` wires the `next-intl` plugin. **There is no `middleware.ts`** — locale handling relies on the `[locale]` segment + `getRequestConfig` in `src/i18n/request.ts`.
- Route groups: `(auth)` (sign-in/up, forgot/reset password, onboarding) and `(dashboard)`. The dashboard splits by role into `admin/`, `doctor/`, `staff/`, `pharmacy/`, `app-owner/`, plus shared `settings/` (roles, users, permissions, audit).
- `src/app/[locale]/(dashboard)/layout.tsx` is `force-dynamic`, resolves the user's role, and renders the role-aware `Sidebar` + `Header`.

### Subscription gating
`src/lib/subscription.ts` — `requireSubscription(plan)` / `hasSubscription(plan)` gate features by plan tier (`free < pro < enterprise`); `admin` bypasses. The DB models a richer subscription system (`subscription_plans`, `tenant_subscriptions`, `payment_records`) than the current 3-tier string check exposes.

### Frontend conventions
- UI primitives in `src/components/ui/` are shadcn/ui components (`components.json`, "new-york" style) — extend these rather than hand-rolling. Feature components live under `src/components/<domain>/` and `src/features/rbac/components/`.
- State: **Zustand** stores in `src/stores/` and `src/features/rbac/stores/` (e.g. `sidebar-store`, `auth-store`); **TanStack Query** and **TanStack Table** for data-fetching/tables; `next-themes` for theming; `sonner` for toasts; `react-hook-form` + `@hookform/resolvers` + Zod for forms.

## Conventions to follow
- **Never write an unscoped tenant query.** Always filter by `clinic_id`/`tenant_id` from `requireTenantInfo()`.
- Check permissions with `hasPermission()` from `src/lib/rbac.ts`, not by inspecting roles directly.
- Prisma accessors and DB fields are snake_case; match the existing style.
- The codebase currently contains `console.log`/`console.error` debug statements and some `any` casts in server actions — the global rules discourage both; prefer typed, log-free code in new work.
