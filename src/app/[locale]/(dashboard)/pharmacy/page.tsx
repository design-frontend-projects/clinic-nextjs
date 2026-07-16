import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";

/**
 * The pharmacy area has no standalone dashboard — its first working view is the
 * dispensing queue. Bare `/pharmacy` (the pharmacist's post-sign-in landing)
 * redirects there so the route resolves instead of 404-ing. The pharmacy layout
 * guard still enforces role access.
 */
export default async function PharmacyIndexPage() {
  return redirect({ href: "/pharmacy/dispensing", locale: await getLocale() });
}
