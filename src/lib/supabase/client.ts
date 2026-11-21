import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseClient() {
  const { url, anonKey } = getSupabaseEnv();

  if (typeof window === "undefined") {
    return createBrowserClient(url, anonKey);
  }

  if (!supabaseClient) {
    supabaseClient = createBrowserClient(url, anonKey);
  }

  return supabaseClient;
}

