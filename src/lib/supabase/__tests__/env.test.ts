import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getPublicSupabaseEnv,
  getSupabaseEnv,
  getSupabaseServiceKey,
} from "../env";

describe("supabase env resolution", () => {
  const originalEnv = { ...process.env };
  const originalWindow = globalThis.window;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    // Ensure clean window state
    Object.defineProperty(globalThis, "window", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  it("reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from runtime process.env", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-123";

    expect(getSupabaseEnv()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key-123",
    });
  });

  it("falls back to SUPABASE_URL and SUPABASE_ANON_KEY when NEXT_PUBLIC_* are empty", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "   ";
    process.env.SUPABASE_URL = "https://fallback.supabase.co";
    process.env.SUPABASE_ANON_KEY = "fallback-anon-key";

    expect(getSupabaseEnv()).toEqual({
      url: "https://fallback.supabase.co",
      anonKey: "fallback-anon-key",
    });
  });

  it("falls back to window.__PUBLIC_ENV__ in the browser when process.env is empty", () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        __PUBLIC_ENV__: {
          NEXT_PUBLIC_SUPABASE_URL: "https://browser.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "browser-anon-key",
        },
      },
      writable: true,
      configurable: true,
    });

    expect(getSupabaseEnv()).toEqual({
      url: "https://browser.supabase.co",
      anonKey: "browser-anon-key",
    });
  });

  it("throws a diagnostic error naming missing variables", () => {
    expect(() => getSupabaseEnv()).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(() => getSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("returns empty strings without throwing in getPublicSupabaseEnv()", () => {
    expect(getPublicSupabaseEnv()).toEqual({ url: "", anonKey: "" });
  });

  it("prefers SUPABASE_SERVICE_ROLE_KEY, supports SUPABASE_SECRET_KEY, and throws if missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-123";

    expect(() => getSupabaseServiceKey()).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );

    process.env.SUPABASE_SECRET_KEY = "sb_secret_fallback";
    expect(getSupabaseServiceKey()).toBe("sb_secret_fallback");

    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";
    expect(getSupabaseServiceKey()).toBe("service-role-secret");
  });

  it("rejects publishable or anon keys passed as SUPABASE_SERVICE_ROLE_KEY", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-123";

    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_publishable_wrong";
    expect(() => getSupabaseServiceKey()).toThrow(/Invalid SUPABASE_SERVICE_ROLE_KEY/);

    process.env.SUPABASE_SERVICE_ROLE_KEY = "anon-key-123";
    expect(() => getSupabaseServiceKey()).toThrow(/Invalid SUPABASE_SERVICE_ROLE_KEY/);
  });
});
