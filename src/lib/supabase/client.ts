import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

export function createSupabaseClient() {
  if (typeof window === "undefined") {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );
  }

  if (!supabaseClient) {
    // Default to true unless explicitly unchecked
    const persistSession = localStorage.getItem("remember_me") !== "false";
    supabaseClient = createClient(
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

  return supabaseClient;
}

