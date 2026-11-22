import { describe, expect, it } from "vitest";
import {
  buildTempPasswordShareMessage,
  buildWhatsAppShareUrl,
  parseWhatsAppPhone,
} from "@/lib/whatsapp/share-link";

describe("parseWhatsAppPhone", () => {
  it("returns empty for null, undefined, or whitespace", () => {
    expect(parseWhatsAppPhone(null)).toEqual({ status: "empty" });
    expect(parseWhatsAppPhone(undefined)).toEqual({ status: "empty" });
    expect(parseWhatsAppPhone("")).toEqual({ status: "empty" });
    expect(parseWhatsAppPhone("   ")).toEqual({ status: "empty" });
  });

  it("normalizes international numbers with +, spaces, dashes, and parentheses", () => {
    expect(parseWhatsAppPhone("+20 101 234 5678")).toEqual({
      status: "valid",
      digits: "201012345678",
    });
    expect(parseWhatsAppPhone("+1 (555) 123-4567")).toEqual({
      status: "valid",
      digits: "15551234567",
    });
    expect(parseWhatsAppPhone("966501234567")).toEqual({
      status: "valid",
      digits: "966501234567",
    });
  });

  it("converts leading 00 international prefix to bare country code digits", () => {
    expect(parseWhatsAppPhone("0020 101 234 5678")).toEqual({
      status: "valid",
      digits: "201012345678",
    });
  });

  it("flags local numbers starting with a single 0 as missing_country_code", () => {
    expect(parseWhatsAppPhone("01012345678")).toEqual({
      status: "missing_country_code",
    });
    expect(parseWhatsAppPhone("050 123 4567")).toEqual({
      status: "missing_country_code",
    });
  });

  it("rejects non-numeric, too short, too long, or all-zero inputs as invalid", () => {
    expect(parseWhatsAppPhone("abc")).toEqual({ status: "invalid" });
    expect(parseWhatsAppPhone("1234567")).toEqual({ status: "invalid" });
    expect(parseWhatsAppPhone("001234567")).toEqual({ status: "invalid" });
    expect(parseWhatsAppPhone("1234567890123456")).toEqual({
      status: "invalid",
    });
    expect(parseWhatsAppPhone("0000000000")).toEqual({ status: "invalid" });
  });
});

describe("buildWhatsAppShareUrl", () => {
  it("builds a direct wa.me URL with normalized digits and URL-encoded text", () => {
    const res = buildWhatsAppShareUrl({
      phone: "+20 101 234 5678",
      text: "Pass: A&B+C#1\nمرحباً",
    });

    expect(res).toEqual({
      url: `https://wa.me/201012345678?text=${encodeURIComponent("Pass: A&B+C#1\nمرحباً")}`,
      usedPhone: true,
    });
  });

  it("opens wa.me contact picker when phone is blank", () => {
    const res = buildWhatsAppShareUrl({
      phone: "  ",
      text: "Hello",
    });

    expect(res).toEqual({
      url: "https://wa.me/?text=Hello",
      usedPhone: false,
    });
  });

  it("returns error when phone is missing country code or invalid", () => {
    expect(
      buildWhatsAppShareUrl({ phone: "01012345678", text: "Hello" }),
    ).toEqual({ error: "missing_country_code" });

    expect(buildWhatsAppShareUrl({ phone: "123", text: "Hello" })).toEqual({
      error: "invalid",
    });
  });
});

describe("buildTempPasswordShareMessage", () => {
  it("includes greeting, intro, email, unadorned password, sign-in URL, and note", () => {
    const msg = buildTempPasswordShareMessage({
      greeting: "Hello Dr. Ahmed,",
      intro: "Your account is ready. Here are your sign-in details:",
      emailLabel: "Email:",
      email: "ahmed@clinic.com",
      passwordLabel: "Temporary password:",
      tempPassword: "X9#k&mP2+q",
      signInUrlLabel: "Sign in:",
      signInUrl: "https://app.clinic.com/en/sign-in",
      changePasswordNote: "Please change your password after signing in.",
    });

    expect(msg).toBe(
      [
        "Hello Dr. Ahmed,",
        "",
        "Your account is ready. Here are your sign-in details:",
        "",
        "Email: ahmed@clinic.com",
        "Temporary password: X9#k&mP2+q",
        "Sign in: https://app.clinic.com/en/sign-in",
        "",
        "Please change your password after signing in.",
      ].join("\n"),
    );
  });

  it("omits optional email and sign-in URL lines when absent", () => {
    const msg = buildTempPasswordShareMessage({
      greeting: "Hello,",
      intro: "Your account is ready.",
      emailLabel: "Email:",
      email: null,
      passwordLabel: "Temporary password:",
      tempPassword: "secret123",
      signInUrlLabel: "Sign in:",
      signInUrl: "",
      changePasswordNote: "Change it after signing in.",
    });

    expect(msg).not.toContain("Email:");
    expect(msg).not.toContain("Sign in:");
    expect(msg).toContain("Temporary password: secret123");
  });
});
