import type { PrismaClient } from "@prisma/client";

type CourseCatalogPrisma = Pick<PrismaClient, "domain" | "targetAudience">;

export async function createTestCourseCatalogRelation(
  prisma: CourseCatalogPrisma,
  grade: number,
) {
  const [domain, targetAudience] = await Promise.all([
    prisma.domain.upsert({
      where: { slug: "toan" },
      update: {},
      create: {
        name: "Toán",
        slug: "toan",
        sortOrder: 1,
      },
    }),
    prisma.targetAudience.upsert({
      where: { code: `GRADE_${grade}` },
      update: {},
      create: {
        code: `GRADE_${grade}`,
        name: `Khối ${grade}`,
        grade,
        sortOrder: grade,
      },
    }),
  ]);

  return {
    domain: {
      connect: { id: domain.id },
    },
    targetAudiences: {
      create: {
        targetAudience: {
          connect: { id: targetAudience.id },
        },
      },
    },
  };
}
