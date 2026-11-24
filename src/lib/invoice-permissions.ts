import { DOCTOR_PAGE_ROLES } from "@/types/clinic.types";

/** Roles allowed to manage catalog items, issue/collect invoices, and edit unlocked invoices. */
export const BILLING_ROLES = [
  "owner",
  "admin",
  "super_admin",
  "doctor",
] as const;

/**
 * Roles permitted to edit an invoice after it is marked paid — strictly the
 * practitioner (`doctor` or practicing `owner`) who created that invoice.
 */
export const CREATOR_DOCTOR_ROLES = DOCTOR_PAGE_ROLES;

export interface InvoicePermissionTarget {
  status: string;
  created_by?: string | null;
}

export interface InvoiceActor {
  profileId: string;
  role: string | null | undefined;
}

export function isBillingRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (BILLING_ROLES as readonly string[]).includes(role);
}

export function isCreatorDoctorRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (CREATOR_DOCTOR_ROLES as readonly string[]).includes(role);
}

export function canMarkInvoiceAsPaid(
  invoice: Pick<InvoicePermissionTarget, "status">,
  actor: Pick<InvoiceActor, "role"> | null | undefined,
): boolean {
  if (!actor || !isBillingRole(actor.role)) return false;
  return invoice.status === "draft" || invoice.status === "issued";
}

/**
 * Determine whether `actor` may edit `invoice`:
 * - `cancelled`: locked for everyone.
 * - `draft` / `issued`: editable by any billing role.
 * - `paid`: locked for everyone EXCEPT the practitioner (`doctor` / practicing
 *   `owner`) who created the invoice (`created_by === actor.profileId`). Legacy
 *   paid invoices with `created_by == null` remain locked for everyone.
 */
export function canEditInvoice(
  invoice: InvoicePermissionTarget,
  actor: InvoiceActor | null | undefined,
): boolean {
  if (!actor || !isBillingRole(actor.role)) return false;
  if (invoice.status === "cancelled") return false;
  if (invoice.status === "draft" || invoice.status === "issued") return true;
  if (invoice.status === "paid") {
    return (
      Boolean(invoice.created_by) &&
      invoice.created_by === actor.profileId &&
      isCreatorDoctorRole(actor.role)
    );
  }
  return false;
}
