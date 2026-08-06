import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const lesson = await prisma.lesson.findFirst({
    where: {
      lessonDocuments: {
        some: {}
      }
    },
    select: { id: true, title: true }
  });
  console.log(lesson);
}
main();
