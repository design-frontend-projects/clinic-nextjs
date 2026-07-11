"use client";

import { useEffect } from "react";

/**
 * Registers the Serwist-built service worker (public/sw.js) in production.
 * Renders nothing. Registration failure is non-fatal — the app still works
 * online without the PWA cache.
 */
export function ServiceWorkerProvider() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // non-fatal
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
