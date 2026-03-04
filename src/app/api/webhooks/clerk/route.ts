import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ClerkWebhookEvent = {
  data: Record<string, unknown>;
  object: string;
  type: string;
};

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 400 },
    );
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Verify the webhook
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: ClerkWebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return NextResponse.json(
      { error: "Webhook verification failed" },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();

  // Handle events
  switch (evt.type) {
    case "user.created": {
      const {
        id: clerkUserId,
        first_name,
        last_name,
        email_addresses,
      } = evt.data as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email_addresses: Array<{
          email_address: string;
          id: string;
        }>;
      };

      const primaryEmail = email_addresses?.[0]?.email_address ?? null;
      const fullName =
        [first_name, last_name].filter(Boolean).join(" ") || "New User";

      // 0. Idempotency Check
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("clerk_user_id", clerkUserId)
        .single();

      if (existingProfile) {
        console.log(
          `✅ Profile already exists for Clerk user ${clerkUserId}, skipping webhook creation.`,
        );
        break;
      }

      // 1. Create a new clinic for this user
      const { data: clinic, error: clinicError } = await supabase
        .from("clinics")
        .insert({
          name: `${first_name || "My"}'s Clinic`,
          email: primaryEmail,
          status: "trial",
        })
        .select("id")
        .single();

      if (clinicError) {
        console.error("Failed to create clinic:", clinicError);
        return NextResponse.json(
          { error: "Failed to create clinic" },
          { status: 500 },
        );
      }

      // 2. Create the profile linked to the clinic
      const { error: profileError } = await supabase.from("profiles").insert({
        clerk_user_id: clerkUserId,
        clinic_id: clinic.id,
        full_name: fullName,
        email: primaryEmail,
        role: "admin",
      });

      if (profileError) {
        console.error("Failed to create profile:", profileError);
        // Clean up the orphaned clinic
        await supabase.from("clinics").delete().eq("id", clinic.id);
        return NextResponse.json(
          { error: "Failed to create profile" },
          { status: 500 },
        );
      }

      console.log(`✅ Created clinic & profile for Clerk user ${clerkUserId}`);
      break;
    }

    case "user.updated": {
      const {
        id: clerkUserId,
        first_name,
        last_name,
        email_addresses,
      } = evt.data as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email_addresses: Array<{
          email_address: string;
          id: string;
        }>;
      };

      const primaryEmail = email_addresses?.[0]?.email_address ?? null;
      const fullName =
        [first_name, last_name].filter(Boolean).join(" ") || "User";

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          email: primaryEmail,
        })
        .eq("clerk_user_id", clerkUserId);

      if (updateError) {
        console.error("Failed to update profile:", updateError);
        return NextResponse.json(
          { error: "Failed to update profile" },
          { status: 500 },
        );
      }

      console.log(`✅ Updated profile for Clerk user ${clerkUserId}`);
      break;
    }

    case "user.deleted": {
      const { id: clerkUserId } = evt.data as { id: string };

      const { error: deleteError } = await supabase
        .from("profiles")
        .delete()
        .eq("clerk_user_id", clerkUserId);

      if (deleteError) {
        console.error("Failed to delete profile:", deleteError);
        return NextResponse.json(
          { error: "Failed to delete profile" },
          { status: 500 },
        );
      }

      console.log(`✅ Deleted profile for Clerk user ${clerkUserId}`);
      break;
    }

    default:
      console.log(`Unhandled webhook event type: ${evt.type}`);
  }

  return NextResponse.json({ success: true });
}
