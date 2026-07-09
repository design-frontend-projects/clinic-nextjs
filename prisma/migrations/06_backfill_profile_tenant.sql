-- Backfill: repair invited users (doctor/staff/etc.) whose profiles.tenant_id was
-- never persisted. This happens when the post-invite profile upsert didn't complete,
-- leaving only the `on_auth_user_created` trigger's NULL-tenant row.
--
-- `user_roles.tenant_id` is reliably stamped with the clinic when a user is invited
-- (rbacService.assignUserRoles(tenant.clinicId, ...)), so it is the source of truth
-- for reconstructing the missing link.
--
-- Apply manually to Supabase (this repo does not use `prisma migrate`).

UPDATE public.profiles p
SET tenant_id = ur.tenant_id,
    clinic_id = COALESCE(p.clinic_id, ur.tenant_id)
FROM public.user_roles ur
WHERE ur.profile_id = p.id
  AND p.tenant_id IS NULL
  AND ur.is_active = TRUE
  AND ur.deleted_at IS NULL;
