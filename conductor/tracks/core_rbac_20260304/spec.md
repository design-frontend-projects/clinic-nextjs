# Specification: Core Dashboard & RBAC Implementation

## Overview
This track focuses on establishing a robust, role-based access control (RBAC) system integrated with Clerk and Prisma. It ensures that users are directed to the correct dashboard and that their navigation and permissions are strictly enforced across the application.

## Requirements
- **Role Detection:** Dynamically identify the user role from Clerk session or Prisma user profile.
- **Role-Based Routing:** Automatically redirect users to their role-specific landing page (e.g., `/admin`, `/doctor`).
- **Middleware Protection:** Use Next.js Middleware to prevent unauthorized access to role-restricted dashboard paths.
- **Dynamic Navigation:** Update the sidebar and header to show links relevant to the user current role.
- **Dashboard Skeletons:** Implement functional dashboard views for all roles (Admin, Doctor, Patient, Staff, Pharmacy).

## Technical Details
- **Authentication:** Clerk
- **Database:** Prisma 7 with `User`, `Roles`, and `Permissions` models.
- **Routing:** Next.js App Router (dashboard route groups).
- **Permissions:** Implement `hasPermission` and `getUserRoles` utilities for use in layouts and API routes.

## Design
- Use **shadcn/ui** Sidebar component for dynamic navigation.
- Dashboard layouts should follow the **Product Guidelines** for clarity and high contrast.
