import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const item = await prisma.providerCatalogItem.findFirst({
    where: { externalKey: "gpt-5.5" }
  });
  console.log(item?.capabilitiesJson);
}

main().finally(() => prisma.$disconnect());
