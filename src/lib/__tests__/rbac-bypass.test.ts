import { describe, it, expect } from "vitest";
import { isBypassRole } from "@/lib/rbac";

describe("isBypassRole (unified permission bypass identity)", () => {
  it("grants bypass to tenant super-users and the platform operator", () => {
    expect(isBypassRole("owner")).toBe(true);
    expect(isBypassRole("admin")).toBe(true);
    expect(isBypassRole("app_owner")).toBe(true);
  });

  it("does not bypass regular clinic roles", () => {
    expect(isBypassRole("staff")).toBe(false);
    expect(isBypassRole("doctor")).toBe(false);
    expect(isBypassRole("patient")).toBe(false);
  });

  it("does not bypass on missing/unknown roles", () => {
    expect(isBypassRole(null)).toBe(false);
    expect(isBypassRole(undefined)).toBe(false);
    expect(isBypassRole("")).toBe(false);
    // "Super Admin" is an RBAC role NAME, never a profiles.role value — must not
    // accidentally match here (that was the original dead-code bug).
    expect(isBypassRole("Super Admin")).toBe(false);
  });
});
