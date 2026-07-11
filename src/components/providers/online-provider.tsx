"use client";

import { useEffect } from "react";
import { onlineManager } from "@tanstack/react-query";
import { useOnlineStore } from "@/stores/online-store";

/**
 * Bridges the browser's online/offline state into both the Zustand online store
 * (drives the offline banner) and TanStack Query's onlineManager (so queries and
 * mutations pause/resume consistently). Renders nothing.
 */
export function OnlineProvider() {
  const setOnline = useOnlineStore((state) => state.setOnline);

  useEffect(() => {
    const update = () => {
      const online =
        typeof navigator !== "undefined" ? navigator.onLine : true;
      setOnline(online);
      onlineManager.setOnline(online);
    };

    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [setOnline]);

  return null;
}
