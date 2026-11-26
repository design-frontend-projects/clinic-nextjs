import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantInfo } from "@/lib/auth";
import { COLLECTION_BY_NAME } from "@/lib/offline/collection-registry";
import { pullChangesForClinic } from "@/lib/offline/sync-server/pull-push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pullRequestSchema = z.object({
  collection: z
    .string()
    .refine((c) => COLLECTION_BY_NAME.has(c), "Unknown sync collection"),
  checkpoint: z
    .object({
      id: z.string().min(1),
      updated_at: z.string().min(1),
    })
    .nullable()
    .optional(),
  batchSize: z.number().int().min(1).max(500).default(300),
});

function errorStatus(message: string): number {
  if (message.startsWith("Unauthorized")) return 401;
  if (message.startsWith("Forbidden")) return 403;
  return 500;
}

/**
 * Parallel RXDB pull endpoint. Replaces serialized Next.js Server Actions so
 * all synced collections can replicate concurrently.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = pullRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid pull payload" },
        { status: 400 },
      );
    }

    const spec = COLLECTION_BY_NAME.get(parsed.data.collection);
    if (!spec) {
      return NextResponse.json(
        { error: "Unknown sync collection" },
        { status: 400 },
      );
    }

    const tenant = await requireTenantInfo();
    const result = await pullChangesForClinic(
      spec,
      tenant.clinicId,
      parsed.data.checkpoint ?? null,
      parsed.data.batchSize,
    );

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sync pull failed";
    return NextResponse.json(
      { error: message },
      { status: errorStatus(message), headers: { "Cache-Control": "no-store" } },
    );
  }
}
