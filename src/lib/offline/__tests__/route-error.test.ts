import { describe, it, expect, vi, afterEach } from "vitest";
import { formatSyncRouteError } from "../sync-server/route-error";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("formatSyncRouteError", () => {
  it("preserves 401 and 403 auth messages without logging internal errors", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(
      formatSyncRouteError("pull", "appointments", new Error("Unauthorized: sign in")),
    ).toEqual({
      status: 401,
      message: "Unauthorized: sign in",
    });

    expect(
      formatSyncRouteError("push", "patients", new Error("Forbidden: missing clinic")),
    ).toEqual({
      status: 403,
      message: "Forbidden: missing clinic",
    });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("logs full context and strips paths/code snippets for Prisma P2022 in non-production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const prismaError = Object.assign(
      new Error(
        "\nInvalid `delegate.findMany()` invocation in\n" +
          "E:\\web-projects\\web-mobile-work-apps\\clinic-nextjs\\.next\\dev\\server\\chunks\\[root]__da2299c2._.js:1845:33\n" +
          "The column `(not available)` does not exist in the current database.",
      ),
      { code: "P2022" },
    );

    const result = formatSyncRouteError("pull", "appointments", prismaError);

    expect(result).toEqual({
      status: 500,
      message: 'Sync pull failed for "appointments" (P2022)',
    });
    expect(result.message).not.toContain("E:\\");
    expect(result.message).not.toContain("delegate.findMany");
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0][0]).toContain('[sync/pull] Failed for collection "appointments"');
    expect(errorSpy.mock.calls[0][1]).toBe(prismaError);
  });

  it("returns generic 500 messages in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const prismaError = Object.assign(new Error("Column missing"), { code: "P2022" });

    expect(formatSyncRouteError("pull", "appointments", prismaError)).toEqual({
      status: 500,
      message: "Sync pull failed",
    });
    expect(formatSyncRouteError("push", "appointments", new Error("boom"))).toEqual({
      status: 500,
      message: "Sync push failed",
    });
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });
});
