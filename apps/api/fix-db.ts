import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const lessons = await prisma.lesson.findMany({
    where: {
      customVideoSettings: {
        not: "null",
      },
    },
  });

  let count = 0;
  for (const lesson of lessons) {
    if (!lesson.customVideoSettings) continue;
    
    let settings: any;
    try {
      settings = typeof lesson.customVideoSettings === "string" 
        ? JSON.parse(lesson.customVideoSettings) 
        : lesson.customVideoSettings;
    } catch (e) {
      continue;
    }
    
    let modified = false;
    
    if (settings.hasLetterbox !== undefined) {
      delete settings.hasLetterbox;
      modified = true;
    }
    
    if (settings.letterboxHeightPercentage !== undefined) {
      delete settings.letterboxHeightPercentage;
      modified = true;
    }
    
    if (settings.letterboxBottomPercentage === undefined) {
      settings.letterboxBottomPercentage = 0;
      modified = true;
    }
    
    if (modified) {
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          customVideoSettings: settings,
        },
      });
      count++;
    }
  }
  console.log(`Updated ${count} lessons`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
