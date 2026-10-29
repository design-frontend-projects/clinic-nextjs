-- 23_billing_catalog_and_insurance.sql
-- Enhances the clinic invoicing and insurance module:
--   1. BillingItemCategory enum ('consultation', 'lab', 'pharmacy', 'prescription', 'procedure', 'other')
--   2. billing_catalog_items table (bilingual EN/AR catalog of billable items & prescription types with price & enable/disable toggle)
--   3. invoice_items columns: catalog_item_id + category
--   4. insurance_providers category-specific deduction overrides (consultation, lab, pharmacy)
--   5. Invoice immutability guard (prevent DELETE on invoices)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BillingItemCategory') THEN
        CREATE TYPE "BillingItemCategory" AS ENUM (
            'consultation',
            'lab',
            'pharmacy',
            'prescription',
            'procedure',
            'other'
        );
    END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 1. billing_catalog_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "billing_catalog_items" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clinic_id"   UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "name_en"     TEXT NOT NULL,
    "name_ar"     TEXT NOT NULL,
    "category"    "BillingItemCategory" NOT NULL DEFAULT 'other',
    "price"       DECIMAL(12,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "is_active"   BOOLEAN NOT NULL DEFAULT true,
    "created_by"  UUID,
    "created_at"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"  TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "billing_catalog_items_clinic_active_idx"
    ON "billing_catalog_items" ("clinic_id", "is_active");
CREATE INDEX IF NOT EXISTS "billing_catalog_items_clinic_category_idx"
    ON "billing_catalog_items" ("clinic_id", "category");

-- ---------------------------------------------------------------------------
-- 2. invoice_items: link to catalog + category
-- ---------------------------------------------------------------------------
ALTER TABLE "invoice_items"
    ADD COLUMN IF NOT EXISTS "catalog_item_id" UUID REFERENCES "billing_catalog_items"("id") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "category"        "BillingItemCategory" NOT NULL DEFAULT 'other';

CREATE INDEX IF NOT EXISTS "invoice_items_catalog_item_id_idx"
    ON "invoice_items" ("catalog_item_id");

-- ---------------------------------------------------------------------------
-- 3. insurance_providers: category-specific deduction rules
-- ---------------------------------------------------------------------------
ALTER TABLE "insurance_providers"
    ADD COLUMN IF NOT EXISTS "consultation_deduction_type"  "InsuranceDeductionType",
    ADD COLUMN IF NOT EXISTS "consultation_deduction_value" DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS "lab_deduction_type"           "InsuranceDeductionType",
    ADD COLUMN IF NOT EXISTS "lab_deduction_value"          DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS "pharmacy_deduction_type"      "InsuranceDeductionType",
    ADD COLUMN IF NOT EXISTS "pharmacy_deduction_value"     DECIMAL(12,2);

-- ---------------------------------------------------------------------------
-- 4. Row Level Security for billing_catalog_items
-- ---------------------------------------------------------------------------
ALTER TABLE "billing_catalog_items" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_catalog_items_clinic_all ON "billing_catalog_items";
CREATE POLICY billing_catalog_items_clinic_all ON "billing_catalog_items"
    FOR ALL TO authenticated
    USING ("clinic_id" = auth.current_tenant_id())
    WITH CHECK ("clinic_id" = auth.current_tenant_id());

DROP POLICY IF EXISTS billing_catalog_items_super_admin ON "billing_catalog_items";
CREATE POLICY billing_catalog_items_super_admin ON "billing_catalog_items"
    FOR ALL TO authenticated
    USING (auth.is_super_admin());

-- ---------------------------------------------------------------------------
-- 5. Prevent hard deletion of invoices (immutability rule)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_invoice_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Invoices cannot be deleted once created. Edit the invoice items instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_invoice_delete ON "invoices";
CREATE TRIGGER trg_prevent_invoice_delete
    BEFORE DELETE ON "invoices"
    FOR EACH ROW
    EXECUTE FUNCTION prevent_invoice_delete();

