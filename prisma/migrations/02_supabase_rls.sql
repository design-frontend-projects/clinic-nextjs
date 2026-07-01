-- 02_supabase_rls.sql
-- Enable Row Level Security (RLS) on all RBAC tables and define policies

-- 1. Helper function to resolve current tenant (clinic) ID
CREATE OR REPLACE FUNCTION auth.current_tenant_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'clinic_id', '')::uuid,
    NULLIF(current_setting('app.current_tenant_id', true), '')::uuid,
    (SELECT id FROM clinics WHERE clerk_user_id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Helper function to check if current user is Super Admin
CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'Super Admin'),
    (SELECT EXISTS (
       SELECT 1 FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.profile_id = (SELECT id FROM profiles WHERE clerk_user_id = auth.uid() LIMIT 1)
         AND r.name = 'Super Admin'
         AND ur.is_active = TRUE
    ))
  );
$$ LANGUAGE sql SECURITY DEFINER;


-- Enable Row Level Security (RLS)
ALTER TABLE "permission_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "permission_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_hierarchy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_group_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;


-- 3. Policies for Permissions and Categories (Read-only for authenticated users, Write for Super Admins)
CREATE POLICY permissions_read ON "permissions"
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY permissions_write ON "permissions"
    FOR ALL TO authenticated USING (auth.is_super_admin());

CREATE POLICY categories_read ON "permission_categories"
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY categories_write ON "permission_categories"
    FOR ALL TO authenticated USING (auth.is_super_admin());

CREATE POLICY groups_read ON "permission_groups"
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY groups_write ON "permission_groups"
    FOR ALL TO authenticated USING (auth.is_super_admin());


-- 4. Policies for Roles (Tenant isolated)
CREATE POLICY roles_tenant_isolation ON "roles"
    FOR ALL TO authenticated
    USING (tenant_id = auth.current_tenant_id())
    WITH CHECK (tenant_id = auth.current_tenant_id());


-- 5. Policies for User Roles (Tenant isolated)
CREATE POLICY user_roles_tenant_isolation ON "user_roles"
    FOR ALL TO authenticated
    USING (tenant_id = auth.current_tenant_id())
    WITH CHECK (tenant_id = auth.current_tenant_id());


-- 6. Policies for Role Permissions (Tenant isolated)
CREATE POLICY role_permissions_tenant_isolation ON "role_permissions"
    FOR ALL TO authenticated
    USING (tenant_id = auth.current_tenant_id())
    WITH CHECK (tenant_id = auth.current_tenant_id());


-- 7. Policies for User Permissions (Tenant isolated)
CREATE POLICY user_permissions_tenant_isolation ON "user_permissions"
    FOR ALL TO authenticated
    USING (tenant_id = auth.current_tenant_id())
    WITH CHECK (tenant_id = auth.current_tenant_id());


-- 8. Policies for Tenant Permissions (Tenant isolated)
CREATE POLICY tenant_permissions_tenant_isolation ON "tenant_permissions"
    FOR ALL TO authenticated
    USING (tenant_id = auth.current_tenant_id())
    WITH CHECK (tenant_id = auth.current_tenant_id());


-- 9. Policies for Tenant Roles (Tenant isolated)
CREATE POLICY tenant_roles_tenant_isolation ON "tenant_roles"
    FOR ALL TO authenticated
    USING (tenant_id = auth.current_tenant_id())
    WITH CHECK (tenant_id = auth.current_tenant_id());


-- 10. Policies for Role Hierarchy (Tenant isolated)
CREATE POLICY role_hierarchy_tenant_isolation ON "role_hierarchy"
    FOR ALL TO authenticated
    USING (tenant_id = auth.current_tenant_id())
    WITH CHECK (tenant_id = auth.current_tenant_id());


-- 11. Policies for Role Groups (Tenant isolated)
CREATE POLICY role_groups_tenant_isolation ON "role_groups"
    FOR ALL TO authenticated
    USING (tenant_id = auth.current_tenant_id())
    WITH CHECK (tenant_id = auth.current_tenant_id());

CREATE POLICY role_group_roles_tenant_isolation ON "role_group_roles"
    FOR ALL TO authenticated
    USING (tenant_id = auth.current_tenant_id())
    WITH CHECK (tenant_id = auth.current_tenant_id());


-- 12. Policies for Audit Logs (Tenant isolated, Insert/Select only)
CREATE POLICY audit_logs_select ON "audit_logs"
    FOR SELECT TO authenticated
    USING (tenant_id = auth.current_tenant_id());

CREATE POLICY audit_logs_insert ON "audit_logs"
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = auth.current_tenant_id());
