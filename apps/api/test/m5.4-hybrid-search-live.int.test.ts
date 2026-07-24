import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { AiProviderName } from "@prisma/client";

import { PrismaModule } from "#api/common/prisma/prisma.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiModule } from "#api/modules/ai/ai.module";
import { RetrievalService } from "#api/modules/ai/services/retrieval.service";
import { AiService } from "#api/modules/ai/services/ai.service";
import { envValidationSchema } from "#api/config/env.validation";
import { stripLatexForEmbedding } from "#api/workers/utils/strip-latex";

describe("M5.4 Hybrid Search Live Test", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let retrievalService: RetrievalService;
  let aiService: AiService;
  let lessonId: string;
  let documentId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validationSchema: envValidationSchema,
          envFilePath: [".env.test", ".env"],
        }),
        PrismaModule,
        AiModule,
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    retrievalService = moduleRef.get(RetrievalService);
    aiService = moduleRef.get(AiService);

    // Setup mock for embeddings to avoid OpenAI rate limits during test
    vi.spyOn(aiService, "createEmbedding").mockImplementation(async () => {
      return {
        vectors: [Array(1536).fill(0.1)],
        model: "text-embedding-3-small",
        dimensions: 1536,
        tokens: 5,
      };
    });

    // Setup dummy lesson and document
    const user = await prisma.user.create({
      data: {
        email: "test-hybrid-" + Date.now() + "@test.com",
        passwordHash: "hash",
        fullName: "Test",
        role: "ADMIN",
      },
    });
    
    const course = await prisma.learningPath.create({
      data: { title: "Course " + Date.now(), createdById: user.id, subject: "MATH", grade: 7, slug: "course-" + Date.now(), originalPriceVnd: 100000 },
    });

    const chapter = await prisma.learningPathChapter.create({
      data: { title: "Chapter " + Date.now(), learningPathId: course.id, orderIndex: 1 },
    });

    const lesson = await prisma.lesson.create({
      data: {
        title: "Lesson " + Date.now(),
        chapterId: chapter.id,
        learningPathId: course.id,
        orderIndex: 1,
        lessonType: "BASIC",
      },
    });
    lessonId = lesson.id;

    const doc = await prisma.lessonDocument.create({
      data: {
        lesson: { connect: { id: lesson.id } },
        title: "Test Doc",
        kind: "SUPPLEMENT",
        status: "READY",
        file: {
          create: {
            publicUrl: "dummy",
            sizeBytes: 1024,
            mimeType: "application/pdf",
            purpose: "LESSON_DOCUMENT",
            bucket: "uploads",
            objectKey: "test-doc-" + Date.now() + ".pdf",
            originalName: "test-doc.pdf",
          },
        },
      },
    });
    documentId = doc.id;

    // Real Mathpix snippet
    const rawContent = `Số hữu tỉ là số viết được dưới dạng phân số \\(\\frac{a}{b}\\) với \\(a, b \\in \\mathbb{Z}, b \\neq 0\\).
Tập hợp các số hữu tỉ được kí hiệu là Q.
\\begin{figure}
\\includegraphics[alt={},max width=\\textwidth]{https://cdn.mathpix.com/img.jpg}
\\caption{Hình minh hoạ}
\\end{figure}`;

    // Embed content for DB
    const strippedText = stripLatexForEmbedding(rawContent);
    const embResult = await aiService.createEmbedding({ texts: [strippedText] });
    const vector = embResult.vectors[0];
    const vectorString = `[${vector.join(",")}]`;

    // Insert chunk via raw SQL
    await prisma.$executeRawUnsafe(`
      INSERT INTO document_chunks (
        id, document_id, lesson_id, chunk_index, content, 
        embedding_provider, embedding_model, embedding_dimensions, embedding
      ) VALUES (
        gen_random_uuid(), '${documentId}'::uuid, '${lessonId}'::uuid, 0, $1, 
        'OPENAI'::"AiProviderName", '${embResult.model}', ${embResult.dimensions}, '${vectorString}'::vector
      )
    `, rawContent);

    // Also insert a "distractor" chunk that is somewhat related but doesn't have the exact formula
    const distractorContent = `Một số ví dụ về phân số và số nguyên. Z là tập hợp số nguyên. Z = {..., -2, -1, 0, 1, 2, ...}`;
    const embResult2 = await aiService.createEmbedding({ texts: [distractorContent] });
    const vector2 = embResult2.vectors[0];
    const vectorString2 = `[${vector2.join(",")}]`;
    
    await prisma.$executeRawUnsafe(`
      INSERT INTO document_chunks (
        id, document_id, lesson_id, chunk_index, content, 
        embedding_provider, embedding_model, embedding_dimensions, embedding
      ) VALUES (
        gen_random_uuid(), '${documentId}'::uuid, '${lessonId}'::uuid, 1, $1, 
        'OPENAI'::"AiProviderName", '${embResult2.model}', ${embResult2.dimensions}, '${vectorString2}'::vector
      )
    `, distractorContent);
  });

  afterAll(async () => {
    // Cleanup
    if (lessonId) {
      await prisma.lesson.delete({ where: { id: lessonId } });
    }
    await moduleRef.close();
  });

  it("should find exact formula using hybrid search when vector search might rank it lower", async () => {
    // We are searching for exactly "a, b \in \mathbb{Z}"
    const result = await retrievalService.retrieveContext({
      lessonId,
      query: "\\mathbb{Z}, b \\neq 0",
      topK: 2,
    });

    expect(result.chunks.length).toBeGreaterThan(0);
    // The chunk with the exact latex should be returned
    expect(result.chunks[0].content).toContain("\\frac{a}{b}");
    
    // Check if it matched via keyword or both
    // Given how specific the query is, keyword MatchCount should be > 0
    expect(result.keywordMatchCount).toBeGreaterThan(0);
    expect(["keyword", "both"]).toContain(result.chunks[0].matchSource);
    
    console.log("Hybrid Match Source:", result.chunks[0].matchSource);
    console.log("Keyword Match Count:", result.keywordMatchCount);
  });
});
