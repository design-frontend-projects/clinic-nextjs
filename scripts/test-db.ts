import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const profiles = await prisma.profiles.findMany({
    select: { id: true, auth_user_id: true, org_id: true },
  });
  console.log("Profiles in DB:", profiles);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
