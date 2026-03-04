import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const profiles = await prisma.profiles.findMany({
    select: { id: true, clerk_user_id: true, clinic_id: true },
  });
  console.log("Profiles in DB:", profiles);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
