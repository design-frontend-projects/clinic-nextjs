/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type {
  PrecacheEntry,
  RuntimeCaching,
  SerwistGlobalConfig,
} from "serwist";
import { NetworkOnly, Serwist } from "serwist";
import {
  LEGACY_RUNTIME_CACHE_NAMES,
  shouldBypassServiceWorker,
} from "../lib/sw-bypass";

// This file is compiled by Serwist (not by the app's tsc — it is excluded in
// tsconfig.json) and emitted to public/sw.js.

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const STATIC_CACHE_NAMES = new Set([
  "google-fonts-webfonts",
  "google-fonts-stylesheets",
  "static-font-assets",
  "static-image-assets",
  "next-static-js-assets",
  "next-image",
  "static-audio-assets",
  "static-video-assets",
  "static-js-assets",
  "static-style-assets",
]);

function getEntryCacheName(entry: RuntimeCaching): string | undefined {
  const handler = entry.handler as { cacheName?: unknown };
  return typeof handler.cacheName === "string" ? handler.cacheName : undefined;
}

const staticAssetRules: RuntimeCaching[] = defaultCache.filter((entry) => {
  const cacheName = getEntryCacheName(entry);
  return cacheName !== undefined && STATIC_CACHE_NAMES.has(cacheName);
});

const documentNavigationRule: RuntimeCaching = {
  matcher: ({ request, sameOrigin }) =>
    sameOrigin && request.mode === "navigate",
  handler: new NetworkOnly(),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [...staticAssetRules, documentNavigationRule],
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
self.addEventListener("activate", (event) => {
  serwist.handleActivate(event);
  event.waitUntil(
    Promise.all(
      LEGACY_RUNTIME_CACHE_NAMES.map((name) => self.caches.delete(name)),
    ).catch(() => {
      // Best-effort cleanup of legacy runtime caches.
    }),
  );
});
self.addEventListener("message", serwist.handleCache);
self.addEventListener("fetch", (event) => {
  if (shouldBypassServiceWorker(event.request, self.location.origin)) {
    return;
  }
  serwist.handleFetch(event);
});
