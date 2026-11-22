-- 25_staff_rbac_role.sql
-- Idempotently seed default RBAC categories, groups, permissions, tenant roles
-- (including the dedicated 'Staff' role), role hierarchy, clinic auto-seeding
-- trigger, and backfill missing user_roles for existing clinic profiles.

-- 1. Permission Categories
INSERT INTO public."permission_categories" ("id", "name", "description") VALUES
  (gen_random_uuid(), 'Clinical', 'Permissions related to patient care, diagnosis, and medical records'),
  (gen_random_uuid(), 'Billing & Finance', 'Permissions related to invoices, payments, and refunds'),
  (gen_random_uuid(), 'Inventory & Operations', 'Permissions related to pharmacy, stocks, and medical suppliers'),
  (gen_random_uuid(), 'Administration', 'Permissions related to staff profiles, roles, and settings')
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "is_active" = TRUE,
  "deleted_at" = NULL;

-- 2. Permission Groups
INSERT INTO public."permission_groups" ("id", "name", "description") VALUES
  (gen_random_uuid(), 'Patients Management', 'All permissions relating to patient profiles'),
  (gen_random_uuid(), 'Appointments Booking', 'All permissions relating to schedules and appointments'),
  (gen_random_uuid(), 'Invoicing & Payments', 'All permissions relating to invoices, payments, and claims'),
  (gen_random_uuid(), 'Pharmacy & Inventory', 'All permissions relating to drugs and stocks'),
  (gen_random_uuid(), 'Staff & User Roles', 'All permissions relating to staff profiles and role assignments')
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "is_active" = TRUE,
  "deleted_at" = NULL;

-- 3. Global Permissions (look up category/group IDs by name so existing rows keep their UUIDs)
WITH perm_defs ("name", "description", "category_name", "group_name") AS (
  VALUES
    -- Patient Permissions
    ('patient.read', 'Can view patient details', 'Clinical', 'Patients Management'),
    ('patient.create', 'Can register new patients', 'Clinical', 'Patients Management'),
    ('patient.update', 'Can edit patient details', 'Clinical', 'Patients Management'),
    ('patient.delete', 'Can soft-delete patients', 'Clinical', 'Patients Management'),
    ('patient.export', 'Can export patient data reports', 'Clinical', 'Patients Management'),

    -- Appointment Permissions
    ('appointment.read', 'Can view appointments list', 'Clinical', 'Appointments Booking'),
    ('appointment.create', 'Can schedule new appointments', 'Clinical', 'Appointments Booking'),
    ('appointment.cancel', 'Can cancel scheduled appointments', 'Clinical', 'Appointments Booking'),

    -- Invoice Permissions
    ('invoice.read', 'Can view billing records', 'Billing & Finance', 'Invoicing & Payments'),
    ('invoice.refund', 'Can issue billing refunds', 'Billing & Finance', 'Invoicing & Payments'),

    -- Inventory Permissions
    ('inventory.stock.update', 'Can update stock counts', 'Inventory & Operations', 'Pharmacy & Inventory'),
    ('inventory.stock.transfer', 'Can transfer drugs between branches', 'Inventory & Operations', 'Pharmacy & Inventory'),

    -- Doctor Schedule Permissions
    ('doctor.schedule.edit', 'Can edit clinical calendars', 'Clinical', 'Appointments Booking'),

    -- Administration / System Settings
    ('settings.roles.manage', 'Can create, edit and assign user roles', 'Administration', 'Staff & User Roles'),
    ('settings.audit.read', 'Can read security audit trails', 'Administration', 'Staff & User Roles'),
    ('settings.users.manage', 'Can invite, edit, and manage clinic personnel', 'Administration', 'Staff & User Roles'),
    ('clinic.manage', 'Can manage clinic configuration and branches', 'Administration', 'Staff & User Roles')
)
INSERT INTO public."permissions" ("id", "name", "description", "category_id", "group_id")
SELECT
  gen_random_uuid(),
  d."name",
  d."description",
  c."id",
  g."id"
FROM perm_defs d
LEFT JOIN public."permission_categories" c ON c."name" = d."category_name"
LEFT JOIN public."permission_groups" g ON g."name" = d."group_name"
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "category_id" = EXCLUDED."category_id",
  "group_id" = EXCLUDED."group_id",
  "is_active" = TRUE,
  "deleted_at" = NULL;

-- 4. Public-schema function to seed default RBAC roles, hierarchy, and grants for a tenant
CREATE OR REPLACE FUNCTION public.seed_tenant_default_rbac(target_tenant_id UUID)
RETURNS VOID AS $$
DECLARE
  super_admin_id UUID;
  owner_id UUID;
  admin_id UUID;
  manager_id UUID;
  doctor_id UUID;
  nurse_id UUID;
  staff_id UUID;
  receptionist_id UUID;
  cashier_id UUID;
  pharmacist_id UUID;
  viewer_id UUID;
BEGIN
  -- Insert System Roles
  INSERT INTO public."roles" ("id", "tenant_id", "name", "description", "is_system") VALUES
    (gen_random_uuid(), target_tenant_id, 'Super Admin', 'Full system-wide administrative access', TRUE),
    (gen_random_uuid(), target_tenant_id, 'Tenant Owner', 'Owner of the clinic organization', TRUE),
    (gen_random_uuid(), target_tenant_id, 'Administrator', 'Administrative controls over the clinic', TRUE),
    (gen_random_uuid(), target_tenant_id, 'Manager', 'Day-to-day operations and staff manager', TRUE),
    (gen_random_uuid(), target_tenant_id, 'Doctor', 'Medical staff practitioner', TRUE),
    (gen_random_uuid(), target_tenant_id, 'Nurse', 'Clinical nursing staff helper', TRUE),
    (gen_random_uuid(), target_tenant_id, 'Lab Technician', 'Clinical lab technician', TRUE),
    (gen_random_uuid(), target_tenant_id, 'Radiologist', 'Radiological imaging specialist', TRUE),
    (gen_random_uuid(), target_tenant_id, 'Staff', 'Front desk and clinic operations staff', TRUE),
    (gen_random_uuid(), target_tenant_id, 'Receptionist', 'Front desk scheduler and patient clerk', TRUE),
    (gen_random_uuid(), target_tenant_id, 'Cashier', 'Billing cashier handling collections', TRUE),
    (gen_random_uuid(), target_tenant_id, 'Pharmacist', 'Pharmacy and stock dispenser', TRUE),
    (gen_random_uuid(), target_tenant_id, 'Customer Service', 'Help desk operator for patients', TRUE),
    (gen_random_uuid(), target_tenant_id, 'Support', 'IT and technical support agent', TRUE),
    (gen_random_uuid(), target_tenant_id, 'Viewer', 'Read-only viewer of basic summaries', TRUE)
  ON CONFLICT ("tenant_id", "name") DO NOTHING;

  -- Resolve role IDs
  SELECT id INTO super_admin_id FROM public."roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Super Admin';
  SELECT id INTO owner_id FROM public."roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Tenant Owner';
  SELECT id INTO admin_id FROM public."roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Administrator';
  SELECT id INTO manager_id FROM public."roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Manager';
  SELECT id INTO doctor_id FROM public."roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Doctor';
  SELECT id INTO nurse_id FROM public."roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Nurse';
  SELECT id INTO staff_id FROM public."roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Staff';
  SELECT id INTO receptionist_id FROM public."roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Receptionist';
  SELECT id INTO cashier_id FROM public."roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Cashier';
  SELECT id INTO pharmacist_id FROM public."roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Pharmacist';
  SELECT id INTO viewer_id FROM public."roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Viewer';

  -- Enable all system roles for the tenant
  INSERT INTO public."tenant_roles" ("id", "tenant_id", "role_id")
  SELECT gen_random_uuid(), target_tenant_id, id
  FROM public."roles"
  WHERE "tenant_id" = target_tenant_id AND "deleted_at" IS NULL
  ON CONFLICT ("tenant_id", "role_id") DO NOTHING;

  -- Role Hierarchy (parent -> child inheritance)
  INSERT INTO public."role_hierarchy" ("id", "tenant_id", "parent_role_id", "child_role_id") VALUES
    (gen_random_uuid(), target_tenant_id, super_admin_id, owner_id),
    (gen_random_uuid(), target_tenant_id, owner_id, admin_id),
    (gen_random_uuid(), target_tenant_id, admin_id, manager_id),
    (gen_random_uuid(), target_tenant_id, manager_id, doctor_id),
    (gen_random_uuid(), target_tenant_id, manager_id, staff_id),
    (gen_random_uuid(), target_tenant_id, manager_id, receptionist_id),
    (gen_random_uuid(), target_tenant_id, manager_id, pharmacist_id),
    (gen_random_uuid(), target_tenant_id, manager_id, cashier_id),
    (gen_random_uuid(), target_tenant_id, doctor_id, nurse_id),
    (gen_random_uuid(), target_tenant_id, staff_id, viewer_id),
    (gen_random_uuid(), target_tenant_id, receptionist_id, viewer_id),
    (gen_random_uuid(), target_tenant_id, nurse_id, viewer_id),
    (gen_random_uuid(), target_tenant_id, cashier_id, viewer_id),
    (gen_random_uuid(), target_tenant_id, pharmacist_id, viewer_id)
  ON CONFLICT ("tenant_id", "parent_role_id", "child_role_id") DO NOTHING;

  -- Viewer (Lowest Role)
  INSERT INTO public."role_permissions" ("id", "tenant_id", "role_id", "permission_id")
  SELECT gen_random_uuid(), target_tenant_id, viewer_id, id FROM public."permissions"
  WHERE "name" IN ('patient.read', 'appointment.read', 'invoice.read')
  ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;

  -- Staff
  INSERT INTO public."role_permissions" ("id", "tenant_id", "role_id", "permission_id")
  SELECT gen_random_uuid(), target_tenant_id, staff_id, id FROM public."permissions"
  WHERE "name" IN ('patient.create', 'patient.update', 'appointment.create', 'appointment.cancel')
  ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;

  -- Receptionist
  INSERT INTO public."role_permissions" ("id", "tenant_id", "role_id", "permission_id")
  SELECT gen_random_uuid(), target_tenant_id, receptionist_id, id FROM public."permissions"
  WHERE "name" IN ('patient.create', 'patient.update', 'appointment.create', 'appointment.cancel')
  ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;

  -- Doctor
  INSERT INTO public."role_permissions" ("id", "tenant_id", "role_id", "permission_id")
  SELECT gen_random_uuid(), target_tenant_id, doctor_id, id FROM public."permissions"
  WHERE "name" IN ('patient.update', 'doctor.schedule.edit')
  ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;

  -- Pharmacist
  INSERT INTO public."role_permissions" ("id", "tenant_id", "role_id", "permission_id")
  SELECT gen_random_uuid(), target_tenant_id, pharmacist_id, id FROM public."permissions"
  WHERE "name" IN ('inventory.stock.update', 'inventory.stock.transfer')
  ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;

  -- Cashier
  INSERT INTO public."role_permissions" ("id", "tenant_id", "role_id", "permission_id")
  SELECT gen_random_uuid(), target_tenant_id, cashier_id, id FROM public."permissions"
  WHERE "name" IN ('invoice.refund')
  ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;

  -- Manager
  INSERT INTO public."role_permissions" ("id", "tenant_id", "role_id", "permission_id")
  SELECT gen_random_uuid(), target_tenant_id, manager_id, id FROM public."permissions"
  WHERE "name" IN ('patient.export', 'settings.roles.manage')
  ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;

  -- Administrator, Tenant Owner, and Super Admin get all permissions
  INSERT INTO public."role_permissions" ("id", "tenant_id", "role_id", "permission_id")
  SELECT gen_random_uuid(), target_tenant_id, admin_id, id FROM public."permissions"
  ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;

  INSERT INTO public."role_permissions" ("id", "tenant_id", "role_id", "permission_id")
  SELECT gen_random_uuid(), target_tenant_id, owner_id, id FROM public."permissions"
  ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;

  INSERT INTO public."role_permissions" ("id", "tenant_id", "role_id", "permission_id")
  SELECT gen_random_uuid(), target_tenant_id, super_admin_id, id FROM public."permissions"
  ON CONFLICT ("tenant_id", "role_id", "permission_id") DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger so newly created clinics automatically receive default RBAC roles & grants
CREATE OR REPLACE FUNCTION public.trg_fn_clinics_seed_default_rbac()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.seed_tenant_default_rbac(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clinics_seed_default_rbac ON public."clinics";
CREATE TRIGGER trg_clinics_seed_default_rbac
AFTER INSERT ON public."clinics"
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_clinics_seed_default_rbac();

-- 6. Seed all existing clinics
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT id FROM public."clinics" LOOP
    PERFORM public.seed_tenant_default_rbac(c.id);
  END LOOP;
END $$;

-- 7. Backfill user_roles for existing active profiles that lack any active RBAC role in their tenant
INSERT INTO public."user_roles" ("id", "tenant_id", "profile_id", "role_id")
SELECT
  gen_random_uuid(),
  p."tenant_id",
  p."id",
  r."id"
FROM public."profiles" p
JOIN public."roles" r
  ON r."tenant_id" = p."tenant_id"
 AND r."deleted_at" IS NULL
 AND r."name" = CASE p."role"::text
   WHEN 'staff' THEN 'Staff'
   WHEN 'receptionist' THEN 'Receptionist'
   WHEN 'doctor' THEN 'Doctor'
   WHEN 'pharmacist' THEN 'Pharmacist'
   WHEN 'admin' THEN 'Administrator'
   WHEN 'owner' THEN 'Tenant Owner'
   ELSE NULL
 END
WHERE p."tenant_id" IS NOT NULL
  AND p."status" = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM public."user_roles" ur
    WHERE ur."tenant_id" = p."tenant_id"
      AND ur."profile_id" = p."id"
      AND ur."is_active" = TRUE
      AND ur."deleted_at" IS NULL
  )
ON CONFLICT ("tenant_id", "profile_id", "role_id") DO NOTHING;
