import { describe, it, expect } from "vitest";
import {
  WahaError,
  getErrorMessage,
  toHumanMessage,
  toActionError,
} from "@/lib/errors";

describe("errors", () => {
  describe("getErrorMessage", () => {
    it("returns the message of an Error", () => {
      expect(getErrorMessage(new Error("boom"))).toBe("boom");
    });
    it("passes through non-empty strings", () => {
      expect(getErrorMessage("nope")).toBe("nope");
    });
    it("falls back for unknown shapes", () => {
      expect(getErrorMessage({})).toBe("Unexpected error");
      expect(getErrorMessage(null)).toBe("Unexpected error");
    });
  });

  describe("toHumanMessage", () => {
    it("maps each WahaError code to curated copy", () => {
      expect(toHumanMessage(new WahaError("unreachable"))).toMatch(/unreachable/i);
      expect(toHumanMessage(new WahaError("auth"))).toMatch(/api key/i);
      expect(toHumanMessage(new WahaError("session_not_connected"))).toMatch(/scan the qr/i);
      expect(toHumanMessage(new WahaError("invalid_number"))).toMatch(/valid whatsapp number/i);
      expect(toHumanMessage(new WahaError("config"))).toMatch(/not configured/i);
    });
    it("uses a generic fallback for unknown errors", () => {
      expect(toHumanMessage({}, "fallback")).toBe("fallback");
    });
  });

  describe("toActionError", () => {
    it("wraps into an { error } envelope", () => {
      expect(toActionError(new WahaError("auth"))).toEqual({
        error: expect.stringMatching(/api key/i),
      });
    });
  });
});
