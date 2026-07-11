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
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4 relative overflow-hidden font-sans">
      {/* Background Spotlight Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(26,38,255,0.1)_0%,transparent_60%)] -z-10 pointer-events-none" />

      <div className="w-full max-w-md space-y-6">
        {/* Brand Logo Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary transition-transform group-hover:scale-105">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
          </Link>
          <h2 className="text-xl font-medium tracking-tight text-foreground mt-2">
            {t("brand.name")}
          </h2>
        </div>

        <Card className="rounded-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-medium tracking-tight text-foreground">
              {t("auth.resetPassword.title")}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {t("auth.resetPassword.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResetPasswordForm />
          </CardContent>
          <CardFooter className="flex justify-center text-sm text-muted-foreground border-t border-hairline-soft pt-4">
            {t("auth.resetPassword.rememberPassword")}{" "}
            <Link
              href="/sign-in"
              className="ms-1 text-accent-blue hover:underline font-medium"
            >
              {t("auth.resetPassword.backToSignIn")}
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
