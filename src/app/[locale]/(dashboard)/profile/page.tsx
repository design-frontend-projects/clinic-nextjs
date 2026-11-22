import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getMyProfile } from "@/app/actions/profile";
import { ProfileClient } from "@/components/profile/profile-client";
import { redirect } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.profile");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function ProfilePage() {
  const profile = await getMyProfile();
  if (!profile) {
    redirect({ href: "/sign-in", locale: await getLocale() });
    return null;
  }

  return <ProfileClient initialProfile={profile} />;
}
