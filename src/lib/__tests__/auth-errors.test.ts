import { describe, it, expect } from "vitest";
import { mapSignInErrorKey } from "../auth-errors";

describe("mapSignInErrorKey", () => {
  it("maps Supabase invalid_credentials code to invalidCredentials", () => {
    expect(
      mapSignInErrorKey({
        code: "invalid_credentials",
        message: "Invalid login credentials",
        status: 400,
      }),
    ).toBe("invalidCredentials");
  });

  it("maps invalid login credentials message fallback to invalidCredentials", () => {
    expect(mapSignInErrorKey(new Error("Invalid login credentials"))).toBe(
      "invalidCredentials",
    );
  });

  it("maps email_not_confirmed to emailNotConfirmed", () => {
    expect(
      mapSignInErrorKey({
        code: "email_not_confirmed",
        message: "Email not confirmed",
        status: 400,
      }),
    ).toBe("emailNotConfirmed");
  });

  it("maps rate limit errors to rateLimited", () => {
    expect(
      mapSignInErrorKey({
        code: "over_request_rate_limit",
        message: "Request rate limit reached",
        status: 429,
      }),
    ).toBe("rateLimited");
    expect(mapSignInErrorKey({ status: 429, message: "Too many requests" })).toBe(
      "rateLimited",
    );
  });

  it("falls back to genericError for unknown errors", () => {
    expect(mapSignInErrorKey(new Error("Network error"))).toBe("genericError");
    expect(mapSignInErrorKey(null)).toBe("genericError");
    expect(mapSignInErrorKey("unexpected")).toBe("genericError");
  });
});
