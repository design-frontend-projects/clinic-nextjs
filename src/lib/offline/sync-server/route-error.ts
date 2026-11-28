export type SyncAction = "pull" | "push";

export interface SyncRouteErrorResult {
  status: number;
  message: string;
}

function extractErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0) {
      return code;
    }
  }
  return undefined;
}

/**
 * Normalize errors thrown inside `/api/sync/{pull,push}` so auth failures
 * preserve 401/403 while internal/Prisma errors are logged with collection
 * context and sanitized before returning to clients.
 */
export function formatSyncRouteError(
  action: SyncAction,
  collection: string | undefined,
  error: unknown,
): SyncRouteErrorResult {
  const rawMessage = error instanceof Error ? error.message : "";
  if (rawMessage.startsWith("Unauthorized")) {
    return { status: 401, message: rawMessage };
  }
  if (rawMessage.startsWith("Forbidden")) {
    return { status: 403, message: rawMessage };
  }

  const targetCollection = collection ?? "unknown";
  console.error(`[sync/${action}] Failed for collection "${targetCollection}"`, error);

  if (process.env.NODE_ENV === "production") {
    return { status: 500, message: `Sync ${action} failed` };
  }

  const code = extractErrorCode(error);
  const message = code
    ? `Sync ${action} failed for "${targetCollection}" (${code})`
    : `Sync ${action} failed for "${targetCollection}"`;
  return { status: 500, message };
}
