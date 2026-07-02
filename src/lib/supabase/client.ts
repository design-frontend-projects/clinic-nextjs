import { createClient } from "@supabase/supabase-js";

export function createSupabaseClient() {
  let persistSession = true;
  if (typeof window !== "undefined") {
    // Default to true unless explicitly unchecked
    persistSession = localStorage.getItem("remember_me") !== "false";
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
}
