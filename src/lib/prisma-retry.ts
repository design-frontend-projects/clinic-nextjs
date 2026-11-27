import { Prisma } from "@prisma/client";

export const READ_ONLY_PRISMA_OPS: ReadonlySet<string> = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

const NON_RETRYABLE_TX_PATTERN =
  /current transaction is aborted|Client has already been ended|Transaction already closed/i;
const NON_RETRYABLE_TX_CODES = new Set(["25P02", "P2028"]);

const PRE_EXECUTION_CONN_PATTERN =
  /Connection terminated due to connection timeout|timeout exceeded when trying to connect/i;

const TRANSIENT_READ_PATTERN =
  /Connection terminated unexpectedly|Client has encountered a connection error|Server has closed the connection/i;
const TRANSIENT_READ_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
  "ENOTFOUND",
  "P1001",
  "P1002",
  "P1017",
]);

interface ErrorDetails {
  messages: string[];
  codes: string[];
}

function collectErrorDetails(err: unknown): ErrorDetails {
  const messages: string[] = [];
  const codes: string[] = [];
  const visited = new Set<object>();
  const queue: Array<{ value: unknown; depth: number }> = [{ value: err, depth: 0 }];

  while (queue.length > 0) {
    const { value, depth } = queue.shift()!;
    if (value == null || depth > 5) continue;

    if (typeof value === "string") {
      messages.push(value);
      continue;
    }
    if (typeof value !== "object") continue;
    if (visited.has(value)) continue;
    visited.add(value);

    const record = value as {
      message?: unknown;
      code?: unknown;
      cause?: unknown;
      meta?: {
        driverAdapterError?: {
          message?: unknown;
          code?: unknown;
          cause?: unknown;
        };
      };
    };

    if (typeof record.message === "string") {
      messages.push(record.message);
    }
    if (typeof record.code === "string") {
      codes.push(record.code);
    }
    if (record.cause !== undefined) {
      queue.push({ value: record.cause, depth: depth + 1 });
    }
    const driverAdapterError = record.meta?.driverAdapterError;
    if (driverAdapterError !== undefined) {
      queue.push({ value: driverAdapterError, depth: depth + 1 });
      if (
        typeof driverAdapterError === "object" &&
        driverAdapterError !== null &&
        driverAdapterError.cause !== undefined
      ) {
        queue.push({ value: driverAdapterError.cause, depth: depth + 2 });
      }
    }
  }

  return { messages, codes };
}

/**
 * Returns true if the error indicates an aborted or closed transaction/client
 * that must never be retried.
 */
export function isNonRetryableTransactionError(err: unknown): boolean {
  const { messages, codes } = collectErrorDetails(err);
  return (
    codes.some((c) => NON_RETRYABLE_TX_CODES.has(c)) ||
    messages.some((m) => NON_RETRYABLE_TX_PATTERN.test(m))
  );
}

/**
 * Returns true for pg-pool timeouts thrown before any client finishes
 * connecting or transmits SQL, making retries safe for all operations.
 */
export function isPreExecutionConnectionError(err: unknown): boolean {
  if (isNonRetryableTransactionError(err)) return false;
  const { messages } = collectErrorDetails(err);
  return messages.some((m) => PRE_EXECUTION_CONN_PATTERN.test(m));
}

/**
 * Returns true for pre-execution timeouts and transient socket/pooler drops
 * safe to retry on read-only Prisma operations.
 */
export function isTransientReadConnectionError(err: unknown): boolean {
  if (isNonRetryableTransactionError(err)) return false;
  if (isPreExecutionConnectionError(err)) return true;
  const { messages, codes } = collectErrorDetails(err);
  return (
    codes.some((c) => TRANSIENT_READ_CODES.has(c)) ||
    messages.some((m) => TRANSIENT_READ_PATTERN.test(m))
  );
}

/**
 * Determines whether a failed Prisma query should be retried based on operation
 * idempotency and error class.
 */
export function shouldRetryPrismaOperation(
  operation: string,
  err: unknown,
): boolean {
  return (
    isPreExecutionConnectionError(err) ||
    (READ_ONLY_PRISMA_OPS.has(operation) && isTransientReadConnectionError(err))
  );
}

export interface RunWithTransientDbRetryParams<T> {
  model: string;
  operation: string;
  execute: () => Promise<T>;
  maxRetries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs a Prisma operation with bounded retries on transient connection errors.
 */
export async function runWithTransientDbRetry<T>({
  model,
  operation,
  execute,
  maxRetries = 1,
  baseDelayMs = 250,
  sleep = defaultSleep,
}: RunWithTransientDbRetryParams<T>): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await execute();
    } catch (err) {
      if (attempt < maxRetries && shouldRetryPrismaOperation(operation, err)) {
        console.warn(
          `[prisma] Transient connection error on ${model}.${operation}, retrying (attempt ${attempt + 2}/${maxRetries + 1})...`,
        );
        await sleep(baseDelayMs * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable retry loop state");
}

export const transientRetryExtension = Prisma.defineExtension({
  name: "transient-connection-retry",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        return runWithTransientDbRetry({
          model,
          operation,
          execute: () => query(args),
        });
      },
    },
  },
});
