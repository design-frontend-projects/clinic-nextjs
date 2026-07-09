import { getTranslations } from "next-intl/server";
import { Building2 } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Friendly notice shown when an authenticated user's profile is not linked to
 * any clinic. Rendered by dashboard layouts in place of the dashboard content,
 * so a misconfigured account gets a clear message instead of a runtime crash.
 */
export async function NoClinicNotice() {
  const t = await getTranslations("dashboard.noClinic");

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md p-6 text-center">
        <CardHeader className="items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </span>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/sign-in">{t("backToSignIn")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
