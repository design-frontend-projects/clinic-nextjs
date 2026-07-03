"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    // Unregister any active service worker from other projects running on localhost:4000
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (registrations.length > 0) {
          Promise.all(
            registrations.map((registration) => registration.unregister())
          ).then((results) => {
            if (results.some(Boolean)) {
              console.log("Unregistered stale service worker(s) successfully. Reloading...");
              window.location.reload();
            }
          });
        }
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
