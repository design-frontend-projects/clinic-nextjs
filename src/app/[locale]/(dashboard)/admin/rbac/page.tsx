import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/**
 * The RBAC UI has been consolidated on the richer `settings/*` module
 * (features/rbac). This legacy route now redirects there.
 */
export default async function RBACPage() {
  return redirect({ href: "/settings/roles", locale: await getLocale() });
}
