import { PrismaClient, ReviewStatus, ContentSource } from '@prisma/client';

const db = new PrismaClient();

async function run() {
  const lessonId = '0ba395e6-d64a-439f-a668-d9cbb3fc9544';
  const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
  console.log("Lesson:", lesson?.title);
  
  if (lesson) {
    const summary = await db.lessonSummary.upsert({
      where: { lessonId },
      create: {
        lessonId,
        contentJson: {
          type: "lesson_summary_blocks",
          data: [
            {
              type: "key_knowledge",
              title: "Kiến thức cần nhớ",
              points: [
                "Số hữu tỉ là số viết được dưới dạng phân số a/b với a, b là các số nguyên, b khác 0.",
                "Tập hợp các số hữu tỉ được kí hiệu là Q.",
                "Mỗi số hữu tỉ đều được biểu diễn bởi một điểm trên trục số."
              ],
              sourceChunkIds: ["chunk-001"]
            },
            {
              type: "rule",
              title: "Quy tắc so sánh số hữu tỉ",
              statement: "Muốn so sánh hai số hữu tỉ, ta làm như sau:",
              steps: [
                "Viết chúng dưới dạng phân số có cùng mẫu dương.",
                "So sánh các tử số. Phân số nào có tử số lớn hơn thì lớn hơn."
              ],
              conditions: [
                "Mẫu số phải là số dương."
              ],
              sourceChunkIds: ["chunk-002"]
            },
            {
              type: "formula",
              title: "Tính chất cơ bản",
              formulas: [
                {
                  latex: "a = \\frac{a}{1}",
                  explanation: "Mọi số nguyên đều là một số hữu tỉ.",
                  conditions: []
                }
              ],
              sourceChunkIds: ["chunk-003"]
            }
          ]
        },
        source: ContentSource.AI,
        reviewStatus: ReviewStatus.APPROVED
      },
      update: {
        contentJson: {
          type: "lesson_summary_blocks",
          data: [
            {
              type: "key_knowledge",
              title: "Kiến thức cần nhớ",
              points: [
                "Số hữu tỉ là số viết được dưới dạng phân số a/b với a, b là các số nguyên, b khác 0.",
                "Tập hợp các số hữu tỉ được kí hiệu là Q.",
                "Mỗi số hữu tỉ đều được biểu diễn bởi một điểm trên trục số."
              ],
              sourceChunkIds: ["chunk-001"]
            },
            {
              type: "rule",
              title: "Quy tắc so sánh số hữu tỉ",
              statement: "Muốn so sánh hai số hữu tỉ, ta làm như sau:",
              steps: [
                "Viết chúng dưới dạng phân số có cùng mẫu dương.",
                "So sánh các tử số. Phân số nào có tử số lớn hơn thì lớn hơn."
              ],
              conditions: [
                "Mẫu số phải là số dương."
              ],
              sourceChunkIds: ["chunk-002"]
            },
            {
              type: "formula",
              title: "Tính chất cơ bản",
              formulas: [
                {
                  latex: "a = \\frac{a}{1}",
                  explanation: "Mọi số nguyên đều là một số hữu tỉ.",
                  conditions: []
                }
              ],
              sourceChunkIds: ["chunk-003"]
            }
          ]
        },
        reviewStatus: ReviewStatus.APPROVED
      }
    });
    console.log("Upserted summary", summary.id);
  } else {
    console.log("Lesson not found");
  }
}
run();
