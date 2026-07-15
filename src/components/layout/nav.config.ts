/**
 * Single source of truth for the dashboard sidebar. Menu items are driven by
 * this role/permission config rather than being hardcoded per page. Titles use
 * i18n message keys (translated client-side); icons are referenced by a string
 * key mapped to a Lucide icon in the Sidebar component.
 */

export interface NavItem {
  titleKey: string;
  href: string;
  iconKey: string;
  /** Roles for which this item is eligible. */
  roles: string[];
  /** Optional permission gate, evaluated server-side. */
  requiredPermission?: string;
}

export const NAV_ITEMS: NavItem[] = [
  // Admin / owner
  { titleKey: "sidebar.dashboard", href: "/admin", iconKey: "dashboard", roles: ["admin", "owner"] },
  { titleKey: "sidebar.doctors", href: "/admin/doctors", iconKey: "doctors", roles: ["admin", "owner"], requiredPermission: "settings.users.manage" },
  { titleKey: "sidebar.staff", href: "/admin/staff", iconKey: "staff", roles: ["admin", "owner"], requiredPermission: "settings.users.manage" },
  { titleKey: "sidebar.patients", href: "/admin/patients", iconKey: "patients", roles: ["admin", "owner"], requiredPermission: "patient.read" },
  { titleKey: "sidebar.appointments", href: "/admin/appointments", iconKey: "appointments", roles: ["admin", "owner"], requiredPermission: "appointment.read" },
  { titleKey: "sidebar.prescriptions", href: "/admin/prescriptions", iconKey: "prescriptions", roles: ["admin", "owner"] },
  { titleKey: "sidebar.billing", href: "/admin/billing", iconKey: "billing", roles: ["admin", "owner"] },
  { titleKey: "sidebar.insurance", href: "/admin/insurance", iconKey: "insurance", roles: ["admin", "owner"] },
  { titleKey: "sidebar.clinicDefinition", href: "/admin/clinics", iconKey: "clinic", roles: ["admin", "owner"] },
  { titleKey: "sidebar.reviews", href: "/admin/reviews", iconKey: "reviews", roles: ["admin", "owner"] },

  // Owner-as-practitioner: personal appointments/labs assigned to the owner
  // (owners may practise as doctors). These deep-link into the shared /doctor
  // pages while the owner keeps their /admin sidebar.
  { titleKey: "sidebar.myAppointments", href: "/doctor/appointments", iconKey: "appointments", roles: ["owner"] },
  { titleKey: "sidebar.labOrders", href: "/doctor/lab-orders", iconKey: "labOrders", roles: ["owner"] },
  { titleKey: "sidebar.myReviews", href: "/doctor/reviews", iconKey: "reviews", roles: ["owner"] },

  // Settings group (RBAC) — gated by settings permissions
  { titleKey: "sidebar.roles", href: "/settings/roles", iconKey: "roles", roles: ["admin", "owner","app_owner"], requiredPermission: "settings.roles.manage" },
  { titleKey: "sidebar.users", href: "/settings/user-roles", iconKey: "users", roles: ["admin", "owner","app_owner"], requiredPermission: "settings.roles.manage" },
  { titleKey: "sidebar.permissions", href: "/settings/permissions", iconKey: "permissions", roles: ["admin", "owner","app_owner"], requiredPermission: "settings.roles.manage" },
  { titleKey: "sidebar.audit", href: "/settings/audit", iconKey: "audit", roles: ["admin", "owner","app_owner"], requiredPermission: "settings.audit.read" },
  { titleKey: "sidebar.notifications", href: "/settings/notifications", iconKey: "notifications", roles: ["admin", "owner", "doctor", "staff", "pharmacist"] },

  // Doctor
  { titleKey: "sidebar.dashboard", href: "/doctor", iconKey: "dashboard", roles: ["doctor"] },
  { titleKey: "sidebar.myAppointments", href: "/doctor/appointments", iconKey: "appointments", roles: ["doctor"] },
  { titleKey: "sidebar.myPatients", href: "/doctor/patients", iconKey: "patients", roles: ["doctor"] },
  { titleKey: "sidebar.prescriptions", href: "/doctor/prescriptions", iconKey: "prescriptions", roles: ["doctor"] },
  { titleKey: "sidebar.labOrders", href: "/doctor/lab-orders", iconKey: "labOrders", roles: ["doctor"] },
  { titleKey: "sidebar.insurance", href: "/doctor/insurance", iconKey: "insurance", roles: ["doctor"] },
  { titleKey: "sidebar.myReviews", href: "/doctor/reviews", iconKey: "reviews", roles: ["doctor"] },

  // Staff
  { titleKey: "sidebar.dashboard", href: "/staff", iconKey: "dashboard", roles: ["staff"] },
  { titleKey: "sidebar.appointments", href: "/staff/booking", iconKey: "appointments", roles: ["staff"] },
  { titleKey: "sidebar.checkinQueue", href: "/staff/checkin", iconKey: "checkin", roles: ["staff"] },
  { titleKey: "sidebar.patients", href: "/staff/patients", iconKey: "patients", roles: ["staff"] },
  { titleKey: "sidebar.billing", href: "/staff/billing", iconKey: "billing", roles: ["staff"] },

  // Patient portal
  { titleKey: "sidebar.dashboard", href: "/patient", iconKey: "dashboard", roles: ["patient"] },
  { titleKey: "sidebar.visitHistory", href: "/patient/appointments", iconKey: "appointments", roles: ["patient"] },
  { titleKey: "sidebar.myProfile", href: "/patient/profile", iconKey: "profile", roles: ["patient"] },
];

/** Serializable nav item passed to the client Sidebar. */
export type ResolvedNavItem = Pick<NavItem, "titleKey" | "href" | "iconKey">;

/**
 * Resolve the nav items visible to a given role, honoring per-item permission
 * gates. `checkPermission` is injected (server-side `hasPermission`) so this
 * stays free of server-only imports.
 */
export async function resolveNavItems(
  role: string,
  checkPermission: (permission: string) => Promise<boolean>,
): Promise<ResolvedNavItem[]> {
  const candidates = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const resolved = await Promise.all(
    candidates.map(async (item) => {
      if (item.requiredPermission) {
        const allowed = await checkPermission(item.requiredPermission);
        if (!allowed) return null;
      }
      return {
        titleKey: item.titleKey,
        href: item.href,
        iconKey: item.iconKey,
      } satisfies ResolvedNavItem;
    }),
  );

  return resolved.filter((i): i is ResolvedNavItem => i !== null);
}
