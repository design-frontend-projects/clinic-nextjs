/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

// This file is compiled by Serwist (not by the app's tsc — it is excluded in
// tsconfig.json) and emitted to public/sw.js.

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Never let the SW touch Supabase (auth tokens, Realtime, PostgREST). RXDB owns
// offline data; caching auth/token responses would corrupt sessions or leak
// data across tenants. Force straight-to-network.
const supabaseNetworkOnly: RuntimeCaching = {
  matcher: ({ url }) => url.hostname.endsWith(".supabase.co"),
  handler: new NetworkOnly(),
};

// NOTE: Serwist runtime strategies only handle GET requests, so Next.js server
// actions (POST) bypass the cache entirely and always hit the network — exactly
// what we want (a queued offline write must never be served a cached response).

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

serwist.addEventListeners();
