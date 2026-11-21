import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, getSupabaseServiceKey } from "./env";

export function createSupabaseServerClient() {
  const { url } = getSupabaseEnv();
  return createClient(
    url,
    getSupabaseServiceKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
