# Implementation Plan: Core Dashboard & RBAC Implementation

## Phase 1: RBAC Core & Middleware

- [ ] Task: Project Audit & Clerk Role Synchronization
    - [ ] Analyze existing Clerk webhook (`api/webhooks/clerk/route.ts`) and Prisma schema.
    - [ ] Write unit tests for role assignment and synchronization logic.
    - [ ] Implement/Update Clerk webhook to ensure role synchronization into Prisma `User`/`Profile` tables.
- [ ] Task: RBAC Utilities & Hooks
    - [ ] Write unit tests for the existing `src/lib/rbac.ts` utilities.
    - [ ] Create a client-side `useRBAC` hook for conditional UI rendering.
    - [ ] Write tests for the `useRBAC` hook.
- [ ] Task: Middleware Protection
    - [ ] Write tests for route-based protection logic (mocking `auth()` and `getTenantInfo()`).
    - [ ] Update `src/middleware.ts` (or `src/proxy.ts`) to strictly enforce role-based access for `/admin`, `/doctor`, etc.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: RBAC Core & Middleware' (Protocol in workflow.md)

## Phase 2: Layouts & Navigation

- [ ] Task: Role-Based Sidebar & Header
    - [ ] Write unit tests for `Sidebar` component with different role contexts.
    - [ ] Update `src/components/layout/sidebar.tsx` to display role-specific navigation items.
    - [ ] Ensure navigation items are synchronized with permissions.
- [ ] Task: Foundation Layouts Updates
    - [ ] Write tests to verify that role-specific layouts redirect unauthorized users.
    - [ ] Update `src/app/(dashboard)/layout.tsx` and nested layouts (`admin/layout.tsx`, `doctor/layout.tsx`) to validate the user current role.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Layouts & Navigation' (Protocol in workflow.md)

## Phase 3: Dashboard Skeletons & Data Fetching

- [ ] Task: Admin Dashboard Implementation
    - [ ] Write tests for the Admin dashboard summary data fetcher.
    - [ ] Implement foundational dashboard view in `src/app/(dashboard)/admin/page.tsx`.
- [ ] Task: Doctor & Staff Dashboard Implementation
    - [ ] Write tests for Doctor specific dashboard data (e.g., today appointments).
    - [ ] Implement foundational dashboard views for Doctor and Staff roles.
- [ ] Task: Patient & Pharmacy Dashboards Implementation
    - [ ] Implement initial dashboard views for Patient and Pharmacy roles.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Dashboard Skeletons & Data Fetching' (Protocol in workflow.md)
