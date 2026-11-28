import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireTenantInfo } from "@/lib/auth";
import { COLLECTION_BY_NAME } from "@/lib/offline/collection-registry";
import {
  pushChangesForClinic,
  type PushRow,
} from "@/lib/offline/sync-server/pull-push";
import { formatSyncRouteError } from "@/lib/offline/sync-server/route-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pushRequestSchema = z.object({
  collection: z
    .string()
    .refine((c) => COLLECTION_BY_NAME.has(c), "Unknown sync collection"),
  rows: z
    .array(
      z.object({
        newDocumentState: z.record(z.string(), z.unknown()),
        assumedMasterState: z
          .record(z.string(), z.unknown())
          .nullable()
          .optional(),
      }),
    )
    .max(200),
});

/**
 * Parallel RXDB push endpoint. Replaces serialized Next.js Server Actions so
 * offline mutations upload concurrently per collection.
 */
export async function POST(request: NextRequest) {
  let collection: string | undefined;
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = pushRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid push payload" },
        { status: 400 },
      );
    }

    collection = parsed.data.collection;
    const spec = COLLECTION_BY_NAME.get(collection);
    if (!spec) {
      return NextResponse.json(
        { error: "Unknown sync collection" },
        { status: 400 },
      );
    }

    const tenant = await requireTenantInfo();
    const conflicts = await pushChangesForClinic(
      spec,
      tenant.clinicId,
      tenant.branchId ?? null,
      parsed.data.rows as PushRow[],
    );

    return NextResponse.json(
      { conflicts },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const { status, message } = formatSyncRouteError("push", collection, error);
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
