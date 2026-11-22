import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";

export default async function LegacyPatientProfilePage() {
  redirect({ href: "/profile", locale: await getLocale() });
}
