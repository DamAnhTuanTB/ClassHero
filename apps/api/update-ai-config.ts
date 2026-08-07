import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const items = await prisma.providerCatalogItem.findMany({
    where: { category: "AI_MODEL" }
  });

  let count = 0;
  for (const item of items) {
    const m = item.externalKey.toLowerCase();
    let aiConfig = "TEMPERATURE";
    
    if (/^(o[1-9]|gpt-5)/.test(m) || m.includes("thinking") || m.includes("gemini-3")) {
      aiConfig = "REASONING_EFFORT";
    }

    let currentCapabilities = item.capabilitiesJson as any;
    if (Array.isArray(currentCapabilities)) {
      currentCapabilities = { features: currentCapabilities };
    } else if (!currentCapabilities) {
      currentCapabilities = { features: [] };
    }
    
    currentCapabilities.aiConfiguration = aiConfig;

    await prisma.providerCatalogItem.update({
      where: { id: item.id },
      data: { capabilitiesJson: currentCapabilities }
    });
    
    console.log(`Updated ${item.externalKey} to ${aiConfig} with ${JSON.stringify(currentCapabilities)}`);
    count++;
  }
  console.log(`Updated ${count} models.`);
}

main()
  .then(() => console.log('Done'))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
