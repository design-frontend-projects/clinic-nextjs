import { getTranslations } from "next-intl/server";
import { WifiOff } from "lucide-react";

// Offline fallback shell served by the service worker when a navigation fails
// while offline. Lives directly under [locale] (not the auth-gated (dashboard)
// group) so it has no data dependencies and renders from cache.
export default async function OfflinePage() {
  const t = await getTranslations("offline");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <WifiOff className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="max-w-md text-muted-foreground">{t("description")}</p>
    </div>
  );
}
