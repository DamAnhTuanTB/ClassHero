import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const doc = await prisma.sourceDocument.findFirst({ where: { html: { not: null } } });
  console.log(doc?.html?.substring(0, 2000));
}
main().finally(() => prisma.$disconnect());
