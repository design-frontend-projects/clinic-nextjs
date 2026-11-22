/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type {
  PrecacheEntry,
  RuntimeCaching,
  SerwistGlobalConfig,
} from "serwist";
import { NetworkOnly, Serwist } from "serwist";

// This file is compiled by Serwist (not by the app's tsc — it is excluded in
// tsconfig.json) and emitted to public/sw.js.

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Auth routes and OAuth/email callbacks must never be intercepted or cached by
// the service worker — letting the browser handle them natively avoids stale
// session responses and prevents `no-response` FetchEvent rejections when
// navigations or RSC refreshes are aborted during sign-in redirects.
const AUTH_PATH_RE =
  /^(?:\/(?:en|ar))?\/(?:sign-in|sign-up|forgot-password|reset-password|onboarding)(?:\/|$)|^\/auth(?:\/|$)/;

function shouldBypassServiceWorker(request: Request): boolean {
  // Never intercept mutations / Next.js Server Actions (POST, PUT, PATCH, DELETE).
  if (request.method !== "GET") {
    return true;
  }

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return true;
  }

  // Never let the SW touch Supabase (auth tokens, Realtime, PostgREST). RXDB
  // owns offline data; intercepting auth/token traffic can corrupt sessions.
  if (url.hostname.endsWith(".supabase.co")) {
    return true;
  }

  if (url.origin === self.location.origin && AUTH_PATH_RE.test(url.pathname)) {
    return true;
  }

  return false;
}

const supabaseNetworkOnly: RuntimeCaching = {
  matcher: ({ url }) => url.hostname.endsWith(".supabase.co"),
  handler: new NetworkOnly(),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [supabaseNetworkOnly, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/ar/offline",
        matcher: ({ request }) =>
          request.destination === "document" &&
          new URL(request.url).pathname.startsWith("/ar"),
      },
      {
        url: "/en/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

self.addEventListener("install", serwist.handleInstall);
self.addEventListener("activate", serwist.handleActivate);
self.addEventListener("message", serwist.handleCache);
self.addEventListener("fetch", (event) => {
  if (shouldBypassServiceWorker(event.request)) {
    return;
  }
  serwist.handleFetch(event);
});
