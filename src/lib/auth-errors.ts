export type SignInErrorKey =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "rateLimited"
  | "genericError";

interface SupabaseAuthLikeError {
  code?: string;
  message?: string;
  status?: number;
}

/**
 * Map a Supabase Auth error from `signInWithPassword` to a localized
 * `auth.signIn.*` translation key.
 */
export function mapSignInErrorKey(error: unknown): SignInErrorKey {
  if (!error || typeof error !== "object") {
    return "genericError";
  }

  const { code, message, status } = error as SupabaseAuthLikeError;
  const normalizedCode = (code ?? "").toLowerCase();
  const normalizedMessage = (message ?? "").toLowerCase();

  if (
    normalizedCode === "invalid_credentials" ||
    normalizedCode === "invalid_grant" ||
    normalizedMessage.includes("invalid login credentials")
  ) {
    return "invalidCredentials";
  }

  if (
    normalizedCode === "email_not_confirmed" ||
    normalizedMessage.includes("email not confirmed")
  ) {
    return "emailNotConfirmed";
  }

  if (
    normalizedCode === "over_request_rate_limit" ||
    normalizedCode === "over_email_send_rate_limit" ||
    status === 429 ||
    normalizedMessage.includes("rate limit") ||
    normalizedMessage.includes("too many requests")
  ) {
    return "rateLimited";
  }

  return "genericError";
}
