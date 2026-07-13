import * as dotenv from 'dotenv';
dotenv.config();
import { prisma } from './src/lib/prisma';
async function main() {
  const d = await prisma.setting_definitions.findMany();
  console.log(JSON.stringify(d, null, 2));
}
main().finally(() => prisma.$disconnect());
