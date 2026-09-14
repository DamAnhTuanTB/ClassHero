import { NestFactory } from "@nestjs/core";
import { AiGenerationType, Prisma } from "@prisma/client";

import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import { buildWholeFeatureUsageTarget } from "#api/modules/provider-operations/utils/provider-usage-target";

const fixtureChunkIds = Array.from(
  { length: 12 },
  (_value, index) => `96600000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);

async function main() {
  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
  const prisma = application.get(PrismaService);
  const providerCalls = application.get(AiProviderCallService);
  const chunks = await prisma.documentChunk.findMany({
    where: { id: { in: fixtureChunkIds } },
    orderBy: { id: "asc" },
    select: { id: true, content: true },
  });
  if (chunks.length !== fixtureChunkIds.length) {
    throw new Error(`Expected ${fixtureChunkIds.length} fixture chunks, found ${chunks.length}.`);
  }

  const output = await providerCalls.createEmbedding(
    {
      feature: AiGenerationType.CHAT,
      operation: "EMBEDDING_GENERATION",
      targetContext: buildWholeFeatureUsageTarget(AiGenerationType.CHAT, null),
      idempotencyKey: "m96d-fixture-embedding-v1",
    },
    { texts: chunks.map((chunk) => chunk.content) },
  );
  if (output.vectors.length !== chunks.length) {
    throw new Error("Fixture embedding output count does not match the chunk count.");
  }

  await prisma.$transaction(
    chunks.map((chunk, index) => {
      const vector = output.vectors[index];
      if (!vector) throw new Error(`Missing embedding for fixture chunk ${chunk.id}.`);
      return prisma.$executeRaw`
        UPDATE document_chunks
        SET embedding = ${`[${vector.join(",")}]`}::vector,
            embedding_provider = 'OPENAI'::"AiProviderName",
            embedding_model = ${output.model},
            embedding_dimensions = ${output.dimensions}
        WHERE id = ${chunk.id}::uuid
      `;
    }),
  );

  process.stdout.write(
    `${JSON.stringify({
      provider: "OPENAI",
      model: output.model,
      dimensions: output.dimensions,
      vectors: output.vectors.length,
      promptTokens: output.usage?.promptTokens ?? null,
    })}\n`,
  );
  } finally {
    await application.close();
  }
}

void main();
