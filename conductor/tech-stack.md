# Technology Stack

## Core
- **Next.js 16 (App Router):** The primary framework for building the application.
- **React 19:** The library for building user interfaces.
- **TypeScript 5:** For static typing and modern JavaScript features.

## Authentication & Security
- **Clerk (@clerk/nextjs):** Provides authentication, user management, and role-based access control.
- **Supabase RLS:** For data-level security and row-level access control.

## Database & Persistence
- **Prisma 7:** The primary ORM for database modeling and querying.
- **PostgreSQL (via pg):** The relational database used for data storage.
- **Supabase:** Used for database hosting and potential real-time features.

## State Management
- **TanStack Query (v5):** For managing server state, caching, and data fetching.
- **Zustand (v5):** For client-side state management (e.g., UI state, user preferences).

## UI & UX
- **Tailwind CSS 4:** The utility-first CSS framework for styling.
- **Radix UI & shadcn/ui:** Accessible, unstyled components with a design system layer.
- **Framer Motion:** For smooth, functional animations and transitions.
- **Lucide React:** The icon library for clinical and administrative symbols.
- **Sonner:** For accessible, clinical-grade toast notifications.

## Forms & Validation
- **React Hook Form:** For managing complex clinical forms.
- **Zod:** For schema validation and type-safe form data handling.

## Utilities
- **date-fns:** For handling clinical dates and times across timezones.
- **clsx & tailwind-merge:** For conditional class handling in components.
