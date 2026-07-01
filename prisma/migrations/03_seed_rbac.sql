-- 03_seed_rbac.sql
-- Seed default categories, groups, and global permissions, and setup auto-seeding for tenants

-- 1. Insert Permission Categories
INSERT INTO "permission_categories" ("id", "name", "description") VALUES
('1a111111-1111-1111-1111-111111111111', 'Clinical', 'Permissions related to patient care, diagnosis, and medical records'),
('2a222222-2222-2222-2222-222222222222', 'Billing & Finance', 'Permissions related to invoices, payments, and refunds'),
('3a333333-3333-3333-3333-333333333333', 'Inventory & Operations', 'Permissions related to pharmacy, stocks, and medical suppliers'),
('4a4a4a4a-4a4a-4a4a-4a4a-4a4a4a4a4a4a', 'Administration', 'Permissions related to staff profiles, roles, and settings')
ON CONFLICT ("name") DO UPDATE SET "description" = EXCLUDED."description";

-- 2. Insert Permission Groups
INSERT INTO "permission_groups" ("id", "name", "description") VALUES
('1b111111-1111-1111-1111-111111111111', 'Patients Management', 'All permissions relating to patient profiles'),
('2b222222-2222-2222-2222-222222222222', 'Appointments Booking', 'All permissions relating to schedules and appointments'),
('3b333333-3333-3333-3333-333333333333', 'Invoicing & Payments', 'All permissions relating to invoices, payments, and claims'),
('4b4b4b4b-4b4b-4b4b-4b4b-4b4b4b4b4b4b', 'Pharmacy & Inventory', 'All permissions relating to drugs and stocks'),
('5b5b5b5b-5b5b-5b5b-5b5b-5b5b5b5b5b5b', 'Staff & User Roles', 'All permissions relating to staff profiles and role assignments')
ON CONFLICT ("name") DO UPDATE SET "description" = EXCLUDED."description";

-- 3. Insert Permissions
-- Format: module.action
-- Actions: Create, Read, Update, Delete, View, Approve, Reject, Assign, Export, Import, Print, Archive, Restore, Manage
INSERT INTO "permissions" ("id", "name", "description", "category_id", "group_id") VALUES
-- Patient Permissions
('11111111-0000-0000-0000-000000000001', 'patient.read', 'Can view patient details', '1a111111-1111-1111-1111-111111111111', '1b111111-1111-1111-1111-111111111111'),
('11111111-0000-0000-0000-000000000002', 'patient.create', 'Can register new patients', '1a111111-1111-1111-1111-111111111111', '1b111111-1111-1111-1111-111111111111'),
('11111111-0000-0000-0000-000000000003', 'patient.update', 'Can edit patient details', '1a111111-1111-1111-1111-111111111111', '1b111111-1111-1111-1111-111111111111'),
('11111111-0000-0000-0000-000000000004', 'patient.delete', 'Can soft-delete patients', '1a111111-1111-1111-1111-111111111111', '1b111111-1111-1111-1111-111111111111'),
('11111111-0000-0000-0000-000000000005', 'patient.export', 'Can export patient data reports', '1a111111-1111-1111-1111-111111111111', '1b111111-1111-1111-1111-111111111111'),

-- Appointment Permissions
('22222222-0000-0000-0000-000000000001', 'appointment.read', 'Can view appointments list', '1a111111-1111-1111-1111-111111111111', '2b222222-2222-2222-2222-222222222222'),
('22222222-0000-0000-0000-000000000002', 'appointment.create', 'Can schedule new appointments', '1a111111-1111-1111-1111-111111111111', '2b222222-2222-2222-2222-222222222222'),
('22222222-0000-0000-0000-000000000003', 'appointment.cancel', 'Can cancel scheduled appointments', '1a111111-1111-1111-1111-111111111111', '2b222222-2222-2222-2222-222222222222'),

-- Invoice Permissions
('33333333-0000-0000-0000-000000000001', 'invoice.read', 'Can view billing records', '2a222222-2222-2222-2222-222222222222', '3b333333-3333-3333-3333-333333333333'),
('33333333-0000-0000-0000-000000000002', 'invoice.refund', 'Can issue billing refunds', '2a222222-2222-2222-2222-222222222222', '3b333333-3333-3333-3333-333333333333'),

-- Inventory Permissions
('44444444-0000-0000-0000-000000000001', 'inventory.stock.update', 'Can update stock counts', '3a333333-3333-3333-3333-333333333333', '4b4b4b4b-4b4b-4b4b-4b4b-4b4b4b4b4b4b'),
('44444444-0000-0000-0000-000000000002', 'inventory.stock.transfer', 'Can transfer drugs between branches', '3a333333-3333-3333-3333-333333333333', '4b4b4b4b-4b4b-4b4b-4b4b-4b4b4b4b4b4b'),

-- Doctor Schedule Permissions
('55555555-0000-0000-0000-000000000001', 'doctor.schedule.edit', 'Can edit clinical calendars', '1a111111-1111-1111-1111-111111111111', '2b222222-2222-2222-2222-222222222222'),

-- Administration / System Settings
('66666666-0000-0000-0000-000000000001', 'settings.roles.manage', 'Can create, edit and assign user roles', '4a4a4a4a-4a4a-4a4a-4a4a-4a4a4a4a4a4a', '5b5b5b5b-5b5b-5b5b-5b5b-5b5b5b5b5b5b'),
('66666666-0000-0000-0000-000000000002', 'settings.audit.read', 'Can read security audit trails', '4a4a4a4a-4a4a-4a4a-4a4a-4a4a4a4a4a4a', '5b5b5b5b-5b5b-5b5b-5b5b-5b5b5b5b5b5b')
ON CONFLICT ("name") DO UPDATE SET "description" = EXCLUDED."description", "category_id" = EXCLUDED."category_id", "group_id" = EXCLUDED."group_id";


-- 4. PG Function to Seed Defaults for a New Clinic (Tenant)
CREATE OR REPLACE FUNCTION auth.seed_tenant_default_rbac(target_tenant_id UUID)
RETURNS VOID AS $$
DECLARE
  super_admin_id UUID := gen_random_uuid();
  owner_id UUID := gen_random_uuid();
  admin_id UUID := gen_random_uuid();
  manager_id UUID := gen_random_uuid();
  doctor_id UUID := gen_random_uuid();
  nurse_id UUID := gen_random_uuid();
  tech_id UUID := gen_random_uuid();
  radio_id UUID := gen_random_uuid();
  receptionist_id UUID := gen_random_uuid();
  cashier_id UUID := gen_random_uuid();
  pharmacist_id UUID := gen_random_uuid();
  cs_id UUID := gen_random_uuid();
  support_id UUID := gen_random_uuid();
  viewer_id UUID := gen_random_uuid();
BEGIN
  -- Insert Roles
  INSERT INTO "roles" ("id", "tenant_id", "name", "description", "is_system") VALUES
    (super_admin_id, target_tenant_id, 'Super Admin', 'Full system-wide administrative access', TRUE),
    (owner_id, target_tenant_id, 'Tenant Owner', 'Owner of the clinic organization', TRUE),
    (admin_id, target_tenant_id, 'Administrator', 'Administrative controls over the clinic', TRUE),
    (manager_id, target_tenant_id, 'Manager', 'Day-to-day operations and staff manager', TRUE),
    (doctor_id, target_tenant_id, 'Doctor', 'Medical staff practitioner', TRUE),
    (nurse_id, target_tenant_id, 'Nurse', 'Clinical nursing staff helper', TRUE),
    (tech_id, target_tenant_id, 'Lab Technician', 'Clinical lab technician', TRUE),
    (radio_id, target_tenant_id, 'Radiologist', 'Radiological imaging specialist', TRUE),
    (receptionist_id, target_tenant_id, 'Receptionist', 'Front desk scheduler and patient clerk', TRUE),
    (cashier_id, target_tenant_id, 'Cashier', 'Billing cashier handling collections', TRUE),
    (pharmacist_id, target_tenant_id, 'Pharmacist', 'Pharmacy and stock dispenser', TRUE),
    (cs_id, target_tenant_id, 'Customer Service', 'Help desk operator for patients', TRUE),
    (support_id, target_tenant_id, 'Support', 'IT and technical support agent', TRUE),
    (viewer_id, target_tenant_id, 'Viewer', 'Read-only viewer of basic summaries', TRUE)
  ON CONFLICT ("tenant_id", "name") DO NOTHING;

  -- Resolve actual IDs in case they existed
  SELECT id INTO super_admin_id FROM "roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Super Admin';
  SELECT id INTO owner_id FROM "roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Tenant Owner';
  SELECT id INTO admin_id FROM "roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Administrator';
  SELECT id INTO manager_id FROM "roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Manager';
  SELECT id INTO doctor_id FROM "roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Doctor';
  SELECT id INTO nurse_id FROM "roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Nurse';
  SELECT id INTO receptionist_id FROM "roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Receptionist';
  SELECT id INTO cashier_id FROM "roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Cashier';
  SELECT id INTO pharmacist_id FROM "roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Pharmacist';
  SELECT id INTO viewer_id FROM "roles" WHERE "tenant_id" = target_tenant_id AND "name" = 'Viewer';

  -- Set up Tenant Roles (Enable all system roles for the tenant)
  INSERT INTO "tenant_roles" ("tenant_id", "role_id")
  SELECT target_tenant_id, id FROM "roles" WHERE "tenant_id" = target_tenant_id
  ON CONFLICT DO NOTHING;

  -- Set up Role Hierarchy (parent -> child links)
  INSERT INTO "role_hierarchy" ("tenant_id", "parent_role_id", "child_role_id") VALUES
    (target_tenant_id, super_admin_id, owner_id),
    (target_tenant_id, owner_id, admin_id),
    (target_tenant_id, admin_id, manager_id),
    (target_tenant_id, manager_id, doctor_id),
    (target_tenant_id, manager_id, receptionist_id),
    (target_tenant_id, manager_id, pharmacist_id),
    (target_tenant_id, manager_id, cashier_id),
    (target_tenant_id, doctor_id, nurse_id),
    (target_tenant_id, receptionist_id, viewer_id),
    (target_tenant_id, nurse_id, viewer_id),
    (target_tenant_id, cashier_id, viewer_id),
    (target_tenant_id, pharmacist_id, viewer_id)
  ON CONFLICT DO NOTHING;

  -- Assign Permissions to Viewer (Lowest Role)
  INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_id")
  SELECT target_tenant_id, viewer_id, id FROM "permissions"
  WHERE "name" IN ('patient.read', 'appointment.read', 'invoice.read')
  ON CONFLICT DO NOTHING;

  -- Assign Permissions to Receptionist
  INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_id")
  SELECT target_tenant_id, receptionist_id, id FROM "permissions"
  WHERE "name" IN ('patient.create', 'patient.update', 'appointment.create', 'appointment.cancel')
  ON CONFLICT DO NOTHING;

  -- Assign Permissions to Doctor
  INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_id")
  SELECT target_tenant_id, doctor_id, id FROM "permissions"
  WHERE "name" IN ('patient.update', 'doctor.schedule.edit')
  ON CONFLICT DO NOTHING;

  -- Assign Permissions to Pharmacist
  INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_id")
  SELECT target_tenant_id, pharmacist_id, id FROM "permissions"
  WHERE "name" IN ('inventory.stock.update', 'inventory.stock.transfer')
  ON CONFLICT DO NOTHING;

  -- Assign Permissions to Cashier
  INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_id")
  SELECT target_tenant_id, cashier_id, id FROM "permissions"
  WHERE "name" IN ('invoice.refund')
  ON CONFLICT DO NOTHING;

  -- Assign Permissions to Manager
  INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_id")
  SELECT target_tenant_id, manager_id, id FROM "permissions"
  WHERE "name" IN ('patient.export', 'settings.roles.manage')
  ON CONFLICT DO NOTHING;

  -- Assign All Permissions to Admin, Owner, and Super Admin
  INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_id")
  SELECT target_tenant_id, admin_id, id FROM "permissions" ON CONFLICT DO NOTHING;

  INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_id")
  SELECT target_tenant_id, owner_id, id FROM "permissions" ON CONFLICT DO NOTHING;

  INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_id")
  SELECT target_tenant_id, super_admin_id, id FROM "permissions" ON CONFLICT DO NOTHING;

END;
$$ LANGUAGE plpgsql;
