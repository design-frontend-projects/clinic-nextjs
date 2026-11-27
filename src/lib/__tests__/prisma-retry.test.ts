import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isPreExecutionConnectionError,
  isNonRetryableTransactionError,
  isTransientReadConnectionError,
  shouldRetryPrismaOperation,
  runWithTransientDbRetry,
} from "../prisma-retry";

describe("isPreExecutionConnectionError", () => {
  it("matches direct and cause/meta-wrapped connection timeout errors", () => {
    expect(
      isPreExecutionConnectionError(
        new Error("Connection terminated due to connection timeout"),
      ),
    ).toBe(true);

    expect(
      isPreExecutionConnectionError(
        new Error("Wrapper", {
          cause: new Error("timeout exceeded when trying to connect"),
        }),
      ),
    ).toBe(true);

    expect(
      isPreExecutionConnectionError({
        message: "Driver adapter error",
        meta: {
          driverAdapterError: {
            cause: {
              message: "Connection terminated due to connection timeout",
            },
          },
        },
      }),
    ).toBe(true);
  });

  it("rejects non-connection errors like P2002 and P2022", () => {
    expect(
      isPreExecutionConnectionError({
        code: "P2002",
        message: "Unique constraint failed",
      }),
    ).toBe(false);

    expect(
      isPreExecutionConnectionError({
        code: "P2022",
        message: "The column does not exist in the current database.",
      }),
    ).toBe(false);
  });
});

describe("shouldRetryPrismaOperation", () => {
  it("allows read retries for timeouts, unexpected terminations, and ECONNRESET", () => {
    const timeoutErr = new Error(
      "Connection terminated due to connection timeout",
    );
    const unexpectedErr = new Error("Connection terminated unexpectedly");
    const econnresetErr = Object.assign(new Error("socket hang up"), {
      code: "ECONNRESET",
    });

    for (const op of [
      "findUnique",
      "findUniqueOrThrow",
      "findFirst",
      "findFirstOrThrow",
      "findMany",
      "count",
      "aggregate",
      "groupBy",
    ]) {
      expect(shouldRetryPrismaOperation(op, timeoutErr)).toBe(true);
      expect(shouldRetryPrismaOperation(op, unexpectedErr)).toBe(true);
      expect(shouldRetryPrismaOperation(op, econnresetErr)).toBe(true);
    }
  });

  it("allows write retries only for pre-execution timeouts, not post-connect drops", () => {
    const timeoutErr = new Error(
      "Connection terminated due to connection timeout",
    );
    const unexpectedErr = new Error("Connection terminated unexpectedly");
    const econnresetErr = Object.assign(new Error("read ECONNRESET"), {
      code: "ECONNRESET",
    });

    for (const op of ["create", "update", "delete", "upsert"]) {
      expect(shouldRetryPrismaOperation(op, timeoutErr)).toBe(true);
      expect(shouldRetryPrismaOperation(op, unexpectedErr)).toBe(false);
      expect(shouldRetryPrismaOperation(op, econnresetErr)).toBe(false);
    }
  });

  it("rejects transaction errors even when wrapped", () => {
    const txAbortedCode = Object.assign(
      new Error("Connection terminated due to connection timeout"),
      { code: "25P02" },
    );
    const txAbortedMsg = new Error(
      "current transaction is aborted, commands ignored until end of transaction block",
    );
    const clientEnded = new Error("Client has already been ended");
    const txClosed = Object.assign(new Error("Transaction already closed"), {
      code: "P2028",
    });

    for (const err of [txAbortedCode, txAbortedMsg, clientEnded, txClosed]) {
      expect(isNonRetryableTransactionError(err)).toBe(true);
      expect(isPreExecutionConnectionError(err)).toBe(false);
      expect(isTransientReadConnectionError(err)).toBe(false);
      expect(shouldRetryPrismaOperation("findFirst", err)).toBe(false);
      expect(shouldRetryPrismaOperation("create", err)).toBe(false);
    }
  });
});

describe("runWithTransientDbRetry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("succeeds on retry after a transient connection timeout", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sleep = vi.fn(async () => {});
    const execute = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new Error("Connection terminated due to connection timeout"),
      )
      .mockResolvedValueOnce("profile-row");

    const result = await runWithTransientDbRetry({
      model: "profiles",
      operation: "findFirst",
      execute,
      sleep,
    });

    expect(result).toBe("profile-row");
    expect(execute).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(250);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("rethrows after maxRetries is exhausted", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sleep = vi.fn(async () => {});
    const execute = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(
        new Error("Connection terminated due to connection timeout"),
      );

    await expect(
      runWithTransientDbRetry({
        model: "profiles",
        operation: "findFirst",
        execute,
        maxRetries: 2,
        baseDelayMs: 100,
        sleep,
      }),
    ).rejects.toThrow("Connection terminated due to connection timeout");

    expect(execute).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-transient errors", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sleep = vi.fn(async () => {});
    const execute = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce({ code: "P2002", message: "Unique constraint failed" });

    await expect(
      runWithTransientDbRetry({
        model: "profiles",
        operation: "findFirst",
        execute,
        sleep,
      }),
    ).rejects.toEqual({ code: "P2002", message: "Unique constraint failed" });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
