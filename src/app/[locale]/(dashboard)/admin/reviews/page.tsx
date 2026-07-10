import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getTenantInfo } from "@/lib/auth";
import { isBypassRole } from "@/lib/rbac";
import { ReviewsModeration } from "@/components/admin/reviews-moderation";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const tenant = await getTenantInfo();

  if (!tenant) {
    return redirect({ href: "/sign-in", locale: await getLocale() });
  }
  if (!isBypassRole(tenant.role)) {
    return redirect({ href: `/${tenant.role || ""}`, locale: await getLocale() });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Patient Reviews</h1>
          <p className="text-muted-foreground">
            Approve reviews to feature them as public testimonials.
          </p>
        </div>
      </div>
      <ReviewsModeration />
    </div>
  );
}
