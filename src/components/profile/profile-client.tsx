"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { getMyProfile } from "@/app/actions/profile";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { ChangePasswordCard } from "@/components/profile/change-password-card";
import { PersonalDetailsCard } from "@/components/profile/personal-details-card";
import { ProfileSummaryCard } from "@/components/profile/profile-summary-card";
import type { UserProfileView } from "@/types/profile.types";

interface ProfileClientProps {
  initialProfile: UserProfileView;
}

export function ProfileClient({ initialProfile }: ProfileClientProps) {
  const t = useTranslations("pages.profile");

  const { data: profile = initialProfile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const next = await getMyProfile();
      return next ?? initialProfile;
    },
    initialData: initialProfile,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-6"
    >
      <Heading title={t("title")} description={t("subtitle")} />
      <Separator />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 xl:col-span-4">
          <ProfileSummaryCard profile={profile} />
        </div>
        <div className="space-y-6 lg:col-span-7 xl:col-span-8">
          <PersonalDetailsCard profile={profile} />
          <ChangePasswordCard />
        </div>
      </div>
    </motion.div>
  );
}
