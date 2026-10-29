# Strategic Plan: Invoicing System, Item Catalog & Category Insurance Enhancements

> [!IMPORTANT]
> **Immutability & Financial Integrity Rule**: Once an invoice is created, it **cannot be deleted** by any user. Users with roles `admin`, `super_admin`, `owner`, or `doctor` may only **edit line items** while the invoice is in `draft` or `issued` status (locked once `paid` or `cancelled`). Any item edit atomically recalculates `invoices.total_amount` and updates any linked `insurance_claims.claim_amount`.

---

## 1. Goals & Architectural Summary

1. **Bilingual Invoice & Prescription Item Catalog (`billing_catalog_items`)**:
   - Allow `admin`, `super_admin`, `owner`, and `doctor` roles to create, edit, and enable/disable (`is_active`) billable catalog items.
   - Support English (`name_en`) and Arabic (`name_ar`) names, `category` (`consultation`, `lab`, `pharmacy`, `prescription`, `procedure`, `other`), default `price`, and optional `description`.
2. **Category-Specific Insurance Deductions (`insurance_providers`)**:
   - Enhance `insurance_providers` to configure specific deduction rules (`fixed` or `percentage` + value) per service category:
     - **Consultation** (`consultation_deduction_type`, `consultation_deduction_value`)
     - **Lab** (`lab_deduction_type`, `lab_deduction_value`)
     - **Pharmacy / Prescription** (`pharmacy_deduction_type`, `pharmacy_deduction_value`)
     - **Default / General Fallback** (`deduction_type`, `deduction_value`)
   - When an insured patient is billed, automatically detect their active eligible policy, compute deductions per category across the selected line items, sum the total insurance deduction, and deduct it from the invoice gross total (consuming 1 covered visit per insured invoice).
3. **Catalog-Driven Create & Edit Invoice Dialog**:
   - Enhance `CreateInvoiceDialog` (`src/components/billing/create-invoice-dialog.tsx`) to show active catalog items in a localized dropdown list with their price and category badge.
   - Auto-fill `unit_price`, `category`, and localized `description` upon selecting an item, while allowing quantity and unit price adjustments.
   - Sum all selected items, preview category-level insurance deductions live, and persist both `catalog_item_id` and `category` on `invoice_items`.
   - Provide an **Edit Invoice Items** flow (reusing the item selector and live insurance recalculation) with zero delete capability on invoices.
4. **Invoice Output & Multi-Channel Delivery (PDF, WhatsApp, Email)**:
   - **Print / Save as PDF**: Dedicated bilingual (Arabic RTL / English LTR) printable invoice dialog/sheet displaying clinic info, patient details, invoice number, itemized table, gross total, insurance provider & deduction breakdown, and net patient payable.
   - **Send via WhatsApp**: Server action leveraging the existing WAHA client (`src/lib/whatsapp/waha-client.ts`) to send a localized invoice receipt to `patient.phone` and log it in `whatsapp_messages`, with a client-side `wa.me` fallback if WAHA is not connected.
   - **Send via Email**: Server action that dispatches an HTML invoice receipt to `patient.email` when SMTP/Resend environment variables are configured, returning a `mailto:` fallback URL when no email gateway is configured.
5. **Unified Access for Admin, Super Admin, Owner & Doctor**:
   - Add a **"Service & Item Catalog"** tab inside the Billing view alongside **"Invoices"**.
   - Expose `/doctor/billing` in the Doctor navigation (`src/components/layout/nav.config.ts`) and include `super_admin` in all billing & insurance role guards.

---

## 2. Phase-by-Phase Breakdown

### Phase 1: Database Schema & Supabase Migration
- Update `prisma/schema.prisma` (`BillingItemCategory`, `billing_catalog_items`, `invoice_items`, `insurance_providers`).
- Create `prisma/migrations/23_billing_catalog_and_insurance.sql` with RLS policies and invoice delete protection.

### Phase 2: Validation Schemas & Category Deduction Engine
- Add `src/types/billing.types.ts` and update `src/types/insurance.types.ts`.
- Add `computeCategoryDeductions` in `src/lib/insurance.ts`.

### Phase 3: Server Actions (Catalog, Invoices, Insurance & Delivery)
- Update `src/app/actions/billing.ts`, `src/app/actions/insurance.ts`, and `src/app/actions/admin.ts`.

### Phase 4: Frontend Components & Pages
- Update `src/components/insurance/insurance-providers-client.tsx`.
- Create `src/components/billing/billing-catalog-tab.tsx`, `src/components/billing/edit-invoice-dialog.tsx`, `src/components/billing/invoice-print-dialog.tsx`, and `src/components/billing/billing-management-client.tsx`.
- Update `src/components/billing/create-invoice-dialog.tsx`, `src/app/[locale]/(dashboard)/admin/billing/page.tsx`, `src/app/[locale]/(dashboard)/doctor/billing/page.tsx`, and `src/components/layout/nav.config.ts`.

### Phase 5: Localization (`next-intl`) & Verification
- Update `src/messages/en.json`, `src/messages/ar.json`, and `src/messages/fr.json`.
- Add unit tests in `src/lib/__tests__/insurance.test.ts` and verify i18n parity.

