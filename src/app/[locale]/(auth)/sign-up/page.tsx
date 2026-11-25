import { SignUpForm } from "@/components/auth/sign-up-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Link } from "@/i18n/routing";
import { Activity } from "lucide-react";
import { getTranslations } from "next-intl/server";
import * as z from "zod";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const t = await getTranslations();
  const { plan } = await searchParams;
  const planParse = z.uuid().safeParse(plan);
  const planId = planParse.success ? planParse.data : undefined;
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4 py-8 font-sans">
      <div className="w-full max-w-2xl space-y-6">
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
              {t("auth.signUp.title")}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {t("auth.signUp.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignUpForm planId={planId} />
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline-soft pt-4 text-sm text-muted-foreground dark:border-hairline">
            <div>
              {t("auth.signUp.alreadyHaveAccount")}{" "}
              <Link
                href="/sign-in"
                className="ms-1 font-medium text-primary hover:underline"
              >
                {t("auth.signUp.signUpButton")}
              </Link>
            </div>
            <Link
              href="/request-status"
              className="font-medium text-primary hover:underline"
            >
              {t("auth.signUp.trackExistingRequest")}
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
