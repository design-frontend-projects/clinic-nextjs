-- Create a trigger to automatically insert a profile when a new user signs up

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  meta_tenant_id uuid := NULLIF(NEW.raw_user_meta_data->>'tenant_id', '')::uuid;
BEGIN
  -- Invited users (doctor/staff/etc.) carry their clinic in user_metadata.tenant_id,
  -- so the profile is born linked to the correct clinic and is never an owner.
  -- Owner self-signup has no tenant_id in metadata -> default to owner/NULL tenant,
  -- which the onboarding flow fills in later. `role` is left to the app-side upsert
  -- (mapping RBAC role names to the ProfileRole enum in SQL would be brittle).
  INSERT INTO public.profiles (
    auth_user_id,
    email,
    full_name,
    is_owner,
    role,
    tenant_id,
    is_profile_completed
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    meta_tenant_id IS NULL,
    'owner',
    meta_tenant_id,
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
