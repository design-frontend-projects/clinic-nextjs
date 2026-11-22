import { ResetPasswordForm } from "@/components/auth/reset-password-form";
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
import { useTranslations } from "next-intl";

export default function ResetPasswordPage() {
  const t = useTranslations();
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4 font-sans">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-button)] bg-primary text-primary-foreground transition-transform group-hover:scale-105">
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
              {t("auth.resetPassword.title")}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {t("auth.resetPassword.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResetPasswordForm />
          </CardContent>
          <CardFooter className="flex justify-center border-t border-hairline-soft pt-4 text-sm text-muted-foreground dark:border-hairline">
            {t("auth.resetPassword.rememberPassword")}{" "}
            <Link
              href="/sign-in"
              className="ms-1 font-medium text-primary hover:underline"
            >
              {t("auth.resetPassword.backToSignIn")}
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
