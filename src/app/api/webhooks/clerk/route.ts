import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error(
      "Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local",
    );
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occured", {
      status: 400,
    });
  }

  const { id } = evt.data;
  const eventType = evt.type;

  if (eventType === "user.created") {
    const { id: clerkId, email_addresses, first_name, last_name } = evt.data;
    const email =
      email_addresses && email_addresses.length > 0
        ? email_addresses[0].email_address
        : null;
    const fullName =
      [first_name, last_name].filter(Boolean).join(" ") || undefined;

    try {
      // Find or create a default clinic
      // In a real SaaS, the user might be invited to a clinic or create one during onboarding.
      // Here we create a default clinic if one doesn't exist, to satisfy the schema constraints.
      let defaultClinic = await prisma.clinics.findFirst({
        where: { name: "Default Clinic" },
      });

      if (!defaultClinic) {
        // We'll create a default clinic with a generated UUID
        const newClinicId = crypto.randomUUID();
        defaultClinic = await prisma.clinics.create({
          data: {
            id: newClinicId,
            name: "Default Clinic",
            status: "active",
          },
        });
      }

      await prisma.profiles.create({
        data: {
          clerk_user_id: clerkId,
          clinic_id: defaultClinic.id,
          full_name: fullName,
          email: email,
          status: "active",
        },
      });
      console.log(`Created profile in Supabase for user ${clerkId}`);
    } catch (error) {
      console.error("Error syncing profile to Supabase:", error);
      return new Response("Error syncing profile", { status: 500 });
    }
  }

  return new Response("", { status: 200 });
}
