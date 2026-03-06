import { createSupabaseServerClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  console.log("userId", userId);

  if (!userId) {
    redirect("/");
  }

  const supabase = createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_profile_completed, email, full_name")
    .eq("clerk_user_id", userId)
    .single();
  console.log("profile", profile);

  if (!profile || profile.role !== "doctor") {
    redirect("/");
  }

  return <>{children}</>;
}
