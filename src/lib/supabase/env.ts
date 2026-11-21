export interface PublicSupabaseEnv {
  url: string;
  anonKey: string;
}

declare global {
  interface Window {
    __PUBLIC_ENV__?: {
      NEXT_PUBLIC_SUPABASE_URL?: string;
      NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    };
  }
}

/**
 * Dynamic property lookup on `process.env` so Webpack's `DefinePlugin` cannot
 * statically inline an empty build-time string (`""`) for `NEXT_PUBLIC_*`
 * variables inside server bundles or `.next/server/middleware.js`.
 */
function readRuntimeEnv(key: string): string | undefined {
  if (typeof process === "undefined" || !process.env) {
    return undefined;
  }
  const value = process.env[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readBrowserPublicEnv(
  key: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY",
): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const value = window.__PUBLIC_ENV__?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

/**
 * Resolve public Supabase URL and anon key without throwing.
 *
 * Resolution order:
 * 1. Runtime `process.env` (server / proxy) — works even if Docker/Coolify
 *    did not pass `NEXT_PUBLIC_*` as build args.
 * 2. Build-time inlined `process.env.NEXT_PUBLIC_*` (client & server).
 * 3. Browser `window.__PUBLIC_ENV__` injected by the root layout at request time.
 */
export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  const url =
    readRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL") ||
    readRuntimeEnv("SUPABASE_URL") ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    readBrowserPublicEnv("NEXT_PUBLIC_SUPABASE_URL") ||
    "";

  const anonKey =
    readRuntimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    readRuntimeEnv("SUPABASE_ANON_KEY") ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    readBrowserPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    "";

  return { url, anonKey };
}

/**
 * Resolve public Supabase URL and anon key, throwing a clear diagnostic error
 * naming the missing environment variable(s) if either is unset.
 */
export function getSupabaseEnv(): PublicSupabaseEnv {
  const { url, anonKey } = getPublicSupabaseEnv();
  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Missing required Supabase environment variable(s): ${missing.join(", ")}. ` +
        `Set them in your runtime environment (and optionally as build args for client inlining).`,
    );
  }

  return { url, anonKey };
}

/**
 * Resolve the server-side Supabase key (prefers `SUPABASE_SERVICE_ROLE_KEY`,
 * falling back to the anon key).
 */
export function getSupabaseServiceKey(): string {
  return (
    readRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY") || getSupabaseEnv().anonKey
  );
}
