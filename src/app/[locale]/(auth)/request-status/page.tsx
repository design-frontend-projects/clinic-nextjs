import { Activity } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { RequestStatusChecker } from "@/components/auth/request-status-checker";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function RequestStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const t = await getTranslations();
  const { ref } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4 font-sans">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-(--radius-button) bg-primary text-primary-foreground transition-transform group-hover:scale-105">
              <Activity className="h-5 w-5" />
            </div>
          </Link>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {t("brand.name")}
          </h2>
        </div>

        <Card elevated cornerAccent>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {t("auth.requestStatus.title")}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {t("auth.requestStatus.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RequestStatusChecker initialRef={ref} />
          </CardContent>
          <CardFooter className="flex justify-between border-t border-hairline-soft pt-4 text-sm text-muted-foreground dark:border-hairline">
            <Link href="/sign-in" className="font-medium text-primary hover:underline">
              {t("auth.requestStatus.backToSignIn")}
            </Link>
            <Link href="/sign-up" className="font-medium text-primary hover:underline">
              {t("auth.requestStatus.backToSignUp")}
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
