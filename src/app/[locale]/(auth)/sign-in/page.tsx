import { SignInForm } from "@/components/auth/sign-in-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import Link from "next/link";
import { Activity } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f] p-4 relative overflow-hidden font-sans">
      {/* Background Spotlight Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(26,38,255,0.1)_0%,transparent_60%)] -z-10 pointer-events-none" />

      <div className="w-full max-w-md space-y-6">
        {/* Brand Logo Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#0007cd] transition-transform group-hover:scale-105 shadow-[0_0_20px_rgba(0,7,205,0.4)]">
              <Activity className="h-6 w-6 text-white" />
            </div>
          </Link>
          <h2 className="text-xl font-medium tracking-tight text-white mt-2">
            ClinicPro
          </h2>
        </div>

        <Card className="bg-[#181818] border border-[#222222] shadow-[0_0_50px_rgba(26,38,255,0.08)] text-white rounded-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-medium tracking-tight text-white">
              Welcome back
            </CardTitle>
            <CardDescription className="text-sm text-[#a8a8a8]">
              Sign in to your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignInForm />
          </CardContent>
          <CardFooter className="flex justify-center text-sm text-[#a8a8a8] border-t border-[#222222]/50 pt-4">
            Dont have an account?{" "}
            <Link
              href="/sign-up"
              className="ml-1 text-[#00d4ff] hover:underline font-medium"
            >
              Sign up
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
