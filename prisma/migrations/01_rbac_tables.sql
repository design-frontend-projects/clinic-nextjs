-- 01_rbac_tables.sql
-- Create RBAC tables in PostgreSQL with full normalization

-- 1. Permission Categories
CREATE TABLE IF NOT EXISTS "permission_categories" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "name" VARCHAR(255) NOT NULL UNIQUE,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID
);

-- 2. Permission Groups
CREATE TABLE IF NOT EXISTS "permission_groups" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "name" VARCHAR(255) NOT NULL UNIQUE,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID
);

-- 3. Permissions
CREATE TABLE IF NOT EXISTS "permissions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "name" VARCHAR(255) NOT NULL UNIQUE,
    "description" TEXT,
    "category_id" UUID REFERENCES "permission_categories"("id") ON DELETE SET NULL,
    "group_id" UUID REFERENCES "permission_groups"("id") ON DELETE SET NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID
);

-- 4. Roles
CREATE TABLE IF NOT EXISTS "roles" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT FALSE,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "roles_tenant_id_name_key" UNIQUE ("tenant_id", "name")
);

-- 5. User Roles (Junction table linking profiles to roles)
CREATE TABLE IF NOT EXISTS "user_roles" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "profile_id" UUID NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "role_id" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "user_roles_tenant_profile_role_key" UNIQUE ("tenant_id", "profile_id", "role_id")
);

-- 6. Role Permissions
CREATE TABLE IF NOT EXISTS "role_permissions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "role_id" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
    "permission_id" UUID NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
    "is_deny" BOOLEAN NOT NULL DEFAULT FALSE,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "role_permissions_tenant_role_permission_key" UNIQUE ("tenant_id", "role_id", "permission_id")
);

-- 7. User Permissions (Custom / Direct / Temporary Overrides)
CREATE TABLE IF NOT EXISTS "user_permissions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "profile_id" UUID NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "permission_id" UUID NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
    "is_deny" BOOLEAN NOT NULL DEFAULT FALSE,
    "expires_at" TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "user_permissions_tenant_profile_permission_key" UNIQUE ("tenant_id", "profile_id", "permission_id")
);

-- 8. Tenant Permissions (Subscription / Core Feature Access Restrictions)
CREATE TABLE IF NOT EXISTS "tenant_permissions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "permission_id" UUID NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "tenant_permissions_tenant_permission_key" UNIQUE ("tenant_id", "permission_id")
);

-- 9. Tenant Roles
CREATE TABLE IF NOT EXISTS "tenant_roles" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "role_id" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "tenant_roles_tenant_role_key" UNIQUE ("tenant_id", "role_id")
);

-- 10. Role Hierarchy
CREATE TABLE IF NOT EXISTS "role_hierarchy" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "parent_role_id" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
    "child_role_id" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "role_hierarchy_tenant_parent_child_key" UNIQUE ("tenant_id", "parent_role_id", "child_role_id")
);

-- 11. Role Groups
CREATE TABLE IF NOT EXISTS "role_groups" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "role_groups_tenant_name_key" UNIQUE ("tenant_id", "name")
);

-- 12. Role Group Roles Mapping
CREATE TABLE IF NOT EXISTS "role_group_roles" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "role_group_id" UUID NOT NULL REFERENCES "role_groups"("id") ON DELETE CASCADE,
    "role_id" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "role_group_roles_tenant_group_role_key" UNIQUE ("tenant_id", "role_group_id", "role_id")
);

-- 13. Audit Logs
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "action" VARCHAR(255) NOT NULL,
    "actor_id" UUID REFERENCES "profiles"("id") ON DELETE SET NULL,
    "actor_email" VARCHAR(255),
    "entity_type" VARCHAR(255),
    "entity_id" UUID,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "device" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID
);

-- Add performance indexes for faster querying and strict tenant isolation
CREATE INDEX IF NOT EXISTS idx_roles_tenant ON "roles"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS idx_permissions_name ON "permissions"("name", "is_active");
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_profile ON "user_roles"("tenant_id", "profile_id", "is_active");
CREATE INDEX IF NOT EXISTS idx_role_permissions_tenant_role ON "role_permissions"("tenant_id", "role_id", "is_active");
CREATE INDEX IF NOT EXISTS idx_user_permissions_tenant_profile ON "user_permissions"("tenant_id", "profile_id", "is_active");
CREATE INDEX IF NOT EXISTS idx_role_hierarchy_tenant_parent ON "role_hierarchy"("tenant_id", "parent_role_id", "is_active");
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action ON "audit_logs"("tenant_id", "action", "created_at");
