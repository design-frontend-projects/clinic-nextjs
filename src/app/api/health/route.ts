import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const readyParam = request.nextUrl.searchParams.get("ready");
  const isReadinessCheck = readyParam === "1" || readyParam === "true";

  // Default fast liveness probe — zero external I/O so Coolify/Docker
  // healthchecks never trigger restart loops during transient DB hiccups.
  if (!isReadinessCheck) {
    return NextResponse.json({ status: "ok", timestamp }, { status: 200 });
  }

  const hasDatabaseUrl =
    typeof process.env.DATABASE_URL === "string" &&
    process.env.DATABASE_URL.trim().length > 0;
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = getPublicSupabaseEnv();
  const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

  if (!hasDatabaseUrl || !hasSupabaseEnv) {
    return NextResponse.json(
      { status: "degraded", db: "unconfigured", env: "missing", timestamp },
      { status: 503 },
    );
  }

  try {
    const { prismaBase } = await import("@/lib/prisma");
    await prismaBase.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ready", db: "ok", timestamp },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", db: "error", timestamp },
      { status: 503 },
    );
  }
}
