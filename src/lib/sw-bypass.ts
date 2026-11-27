export const AUTH_PATH_RE =
  /^(?:\/(?:en|ar))?\/(?:sign-in|sign-up|forgot-password|reset-password|onboarding)(?:\/|$)|^\/auth(?:\/|$)/;

export const LEGACY_RUNTIME_CACHE_NAMES = [
  "pages",
  "pages-rsc",
  "pages-rsc-prefetch",
  "others",
  "apis",
  "cross-origin",
] as const;

/**
 * Detect Next.js App Router RSC payload and prefetch requests so the service
 * worker never intercepts or caches them with NetworkFirst (which throws
 * `no-response` when an RSC navigation/prefetch aborts or fails offline).
 */
export function isNextRscRequest(request: Request, url: URL): boolean {
  return (
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1" ||
    request.headers.get("Next-Router-State-Tree") !== null ||
    request.headers.get("Next-Router-Segment-Prefetch") !== null ||
    url.searchParams.has("_rsc")
  );
}

/**
 * Determine whether a FetchEvent should bypass the service worker completely
 * and go straight to the browser's native network stack.
 */
export function shouldBypassServiceWorker(
  request: Request,
  selfOrigin: string,
): boolean {
  if (request.method !== "GET") {
    return true;
  }

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return true;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return true;
  }

  if (url.hostname.endsWith(".supabase.co")) {
    return true;
  }

  if (url.origin === selfOrigin) {
    if (url.pathname.startsWith("/api/")) {
      return true;
    }

    if (AUTH_PATH_RE.test(url.pathname)) {
      return true;
    }

    if (isNextRscRequest(request, url)) {
      return true;
    }
  }

  return false;
}
