import "dotenv/config";
import { createHash, scryptSync } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AiProviderName,
  AttemptStatus,
  ContentSource,
  DeliveryStatus,
  Difficulty,
  DiscountType,
  DocumentStatus,
  FavoriteTargetType,
  FilePurpose,
  FileStatus,
  FileVisibility,
  Gender,
  LessonMaterialType,
  LessonProgressStatus,
  NotificationChannel,
  NotificationKind,
  NotificationType,
  NewsType,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  PrismaClient,
  PublishStatus,
  QuestionType,
  ReportStatus,
  ReportTargetType,
  ReviewStatus,
  UserRole,
  UserStatus,
  XpEventSource,
} from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString || connectionString.includes("USER:PASSWORD@HOST")) {
  throw new Error("DATABASE_URL must point to a dev database before running seed.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  student: "00000000-0000-4000-8000-000000000002",
  parent: "00000000-0000-4000-8000-000000000003",
  studentProfile: "00000000-0000-4000-8000-000000000004",
  parentProfile: "00000000-0000-4000-8000-000000000005",
  parentLink: "00000000-0000-4000-8000-000000000006",
  learningPath: "00000000-0000-4000-8000-000000000010",
  chapter1: "00000000-0000-4000-8000-000000000070",
  lesson1: "00000000-0000-4000-8000-000000000011",
  lesson2: "00000000-0000-4000-8000-000000000012",
  material1: "00000000-0000-4000-8000-000000000013",
  material2: "00000000-0000-4000-8000-000000000014",
  summary1: "00000000-0000-4000-8000-000000000015",
  summary2: "00000000-0000-4000-8000-000000000016",
  documentFile: "00000000-0000-4000-8000-000000000017",
  document: "00000000-0000-4000-8000-000000000018",
  chunk1: "00000000-0000-4000-8000-000000000019",
  chunk2: "00000000-0000-4000-8000-000000000020",
  chunk3: "00000000-0000-4000-8000-000000000021",
  quizSet: "00000000-0000-4000-8000-000000000030",
  quizQuestion1: "00000000-0000-4000-8000-000000000031",
  quizQuestion2: "00000000-0000-4000-8000-000000000032",
  quizQuestion3: "00000000-0000-4000-8000-000000000033",
  quizAttempt: "00000000-0000-4000-8000-000000000034",
  quizAnswer1: "00000000-0000-4000-8000-000000000035",
  flashcardSet: "00000000-0000-4000-8000-000000000040",
  flashcard1: "00000000-0000-4000-8000-000000000041",
  flashcard2: "00000000-0000-4000-8000-000000000042",
  flashcard3: "00000000-0000-4000-8000-000000000043",
  flashcardProgress: "00000000-0000-4000-8000-000000000044",
  favorite: "00000000-0000-4000-8000-000000000045",
  testSet: "00000000-0000-4000-8000-000000000050",
  testQuestion1: "00000000-0000-4000-8000-000000000051",
  testQuestion2: "00000000-0000-4000-8000-000000000052",
  testQuestion3: "00000000-0000-4000-8000-000000000053",
  testQuestion4: "00000000-0000-4000-8000-000000000054",
  testQuestion5: "00000000-0000-4000-8000-000000000055",
  testAttempt: "00000000-0000-4000-8000-000000000056",
  testAnswer1: "00000000-0000-4000-8000-000000000057",
  lessonProgress: "00000000-0000-4000-8000-000000000058",
  discountCode: "00000000-0000-4000-8000-000000000060",
  payment: "00000000-0000-4000-8000-000000000061",
  webhookLog: "00000000-0000-4000-8000-000000000062",
  enrollment: "00000000-0000-4000-8000-000000000063",
  studentNotification: "00000000-0000-4000-8000-000000000070",
  parentNotification: "00000000-0000-4000-8000-000000000071",
  studentNotificationDelivery: "00000000-0000-4000-8000-000000000072",
  parentNotificationDelivery: "00000000-0000-4000-8000-000000000073",
  report: "00000000-0000-4000-8000-000000000080",
  studentNote: "00000000-0000-4000-8000-000000000081",
  lessonVideoComment: "00000000-0000-4000-8000-000000000082",
  xpEvent: "00000000-0000-4000-8000-000000000090",
  newsItem: "00000000-0000-4000-8000-000000000091",
};

function devPasswordHash(password: string) {
  const salt = "learning-path-dev-seed-v1";
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function hashText(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function docText(text: string): Prisma.InputJsonValue {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

function textNode(text: string): Prisma.InputJsonValue {
  return { text };
}

function multipleChoiceOptions(
  options: Array<{ id: string; text: string }>,
): Prisma.InputJsonValue {
  return options;
}

async function seedUsers() {
  const passwordHash = {
    admin: devPasswordHash("123456"),
    student: devPasswordHash("Student123!"),
    parent: devPasswordHash("Parent123!"),
  };

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      username: "admin",
      passwordHash: passwordHash.admin,
      fullName: "Admin hệ thống",
      emailVerifiedAt: new Date(),
    },
    create: {
      id: ids.admin,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      email: "admin@example.com",
      username: "admin",
      passwordHash: passwordHash.admin,
      fullName: "Admin hệ thống",
      gender: Gender.UNKNOWN,
      emailVerifiedAt: new Date(),
    },
  });

  const student = await prisma.user.upsert({
    where: { email: "student1@example.com" },
    update: {
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      phone: "0900000001",
      username: "student1",
      passwordHash: passwordHash.student,
      fullName: "Nguyễn Văn An",
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
    },
    create: {
      id: ids.student,
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      email: "student1@example.com",
      phone: "0900000001",
      username: "student1",
      passwordHash: passwordHash.student,
      fullName: "Nguyễn Văn An",
      gender: Gender.UNKNOWN,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
    },
  });

  await prisma.studentProfile.upsert({
    where: { userId: student.id },
    update: {
      grade: 7,
      childCode: "CHILD001",
      displayName: "An",
      totalXp: 120,
      level: 2,
    },
    create: {
      id: ids.studentProfile,
      userId: student.id,
      grade: 7,
      childCode: "CHILD001",
      displayName: "An",
      totalXp: 120,
      level: 2,
    },
  });

  const parent = await prisma.user.upsert({
    where: { email: "parent1@example.com" },
    update: {
      role: UserRole.PARENT,
      status: UserStatus.ACTIVE,
      phone: "0910000001",
      username: "parent1",
      passwordHash: passwordHash.parent,
      fullName: "Phụ huynh An",
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
    },
    create: {
      id: ids.parent,
      role: UserRole.PARENT,
      status: UserStatus.ACTIVE,
      email: "parent1@example.com",
      phone: "0910000001",
      username: "parent1",
      passwordHash: passwordHash.parent,
      fullName: "Phụ huynh An",
      gender: Gender.UNKNOWN,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
    },
  });

  await prisma.parentProfile.upsert({
    where: { userId: parent.id },
    update: {},
    create: {
      id: ids.parentProfile,
      userId: parent.id,
    },
  });

  await prisma.parentStudentLink.upsert({
    where: { studentUserId: student.id },
    update: {
      parentUserId: parent.id,
    },
    create: {
      id: ids.parentLink,
      parentUserId: parent.id,
      studentUserId: student.id,
    },
  });

  return { admin, student, parent };
}

async function seedLearningContent(adminId: string) {
  const now = new Date();
  await Promise.all([
    prisma.targetAudience.upsert({
      where: { code: "PRIMARY_SCHOOL" },
      update: { name: "Khối Tiểu học", grade: null, sortOrder: 20 },
      create: {
        id: "20000000-0000-4000-8000-000000000090",
        code: "PRIMARY_SCHOOL",
        name: "Khối Tiểu học",
        grade: null,
        sortOrder: 20,
      },
    }),
    prisma.targetAudience.upsert({
      where: { code: "SECONDARY_SCHOOL" },
      update: { name: "Khối THCS", grade: null, sortOrder: 21 },
      create: {
        id: "20000000-0000-4000-8000-000000000091",
        code: "SECONDARY_SCHOOL",
        name: "Khối THCS",
        grade: null,
        sortOrder: 21,
      },
    }),
    prisma.targetAudience.upsert({
      where: { code: "HIGH_SCHOOL" },
      update: { name: "Khối THPT", grade: null, sortOrder: 22 },
      create: {
        id: "20000000-0000-4000-8000-000000000092",
        code: "HIGH_SCHOOL",
        name: "Khối THPT",
        grade: null,
        sortOrder: 22,
      },
    }),
    prisma.targetAudience.upsert({
      where: { code: "ALL_STUDENTS" },
      update: { name: "Toàn khối", grade: null, sortOrder: 23 },
      create: {
        id: "20000000-0000-4000-8000-000000000093",
        code: "ALL_STUDENTS",
        name: "Toàn khối",
        grade: null,
        sortOrder: 23,
      },
    }),
  ]);
  const mathDomain = await prisma.domain.upsert({
    where: { slug: "toan" },
    update: { name: "Toán", sortOrder: 1 },
    create: { id: "10000000-0000-4000-8000-000000000001", name: "Toán", slug: "toan", sortOrder: 1 },
  });
  const gradeSevenAudience = await prisma.targetAudience.upsert({
    where: { code: "GRADE_7" },
    update: { name: "Khối 7", grade: 7, sortOrder: 7 },
    create: { id: "20000000-0000-4000-8000-000000000007", code: "GRADE_7", name: "Khối 7", grade: 7, sortOrder: 7 },
  });

  const learningPath = await prisma.learningPath.upsert({
    where: { slug: "toan-7" },
    update: {
      domainId: mathDomain.id,
      targetAudiences: {
        deleteMany: {},
        create: {
          targetAudience: { connect: { id: gradeSevenAudience.id } },
        },
      },
      title: "Toán 7",
      originalPriceVnd: 2_000_000,
      salePriceVnd: 1_500_000,
      totalChapterCount: 1,
      totalLessonCount: 2,
      status: PublishStatus.PUBLISHED,
      trialEnabled: false,
      publishedAt: addDays(now, -7),
      sortOrder: 1,
      updatedById: adminId,
    },
    create: {
      id: ids.learningPath,
      domainId: mathDomain.id,
      targetAudiences: {
        create: {
          targetAudience: { connect: { id: gradeSevenAudience.id } },
        },
      },
      title: "Toán 7",
      slug: "toan-7",
      originalPriceVnd: 2_000_000,
      salePriceVnd: 1_500_000,
      totalChapterCount: 1,
      totalLessonCount: 2,
      descriptionJson: docText(
        "Lộ trình Toán 7 mẫu để kiểm tra luồng học, quiz và payment.",
      ),
      status: PublishStatus.PUBLISHED,
      trialEnabled: false,
      publishedAt: addDays(now, -7),
      sortOrder: 1,
      createdById: adminId,
      updatedById: adminId,
    },
  });

  const chapter1 = await prisma.learningPathChapter.upsert({
    where: {
      learningPathId_orderIndex: {
        learningPathId: learningPath.id,
        orderIndex: 1,
      },
    },
    update: {
      title: "Chương 1 - Số hữu tỉ",
      overview: "Tổng quan số hữu tỉ và các phép toán nền tảng.",
      objectivesJson: {
        text: "Nhận biết số hữu tỉ; thực hiện phép tính cơ bản.",
      },
      status: PublishStatus.PUBLISHED,
      updatedById: adminId,
    },
    create: {
      id: ids.chapter1,
      learningPathId: learningPath.id,
      orderIndex: 1,
      title: "Chương 1 - Số hữu tỉ",
      overview: "Tổng quan số hữu tỉ và các phép toán nền tảng.",
      objectivesJson: {
        text: "Nhận biết số hữu tỉ; thực hiện phép tính cơ bản.",
      },
      status: PublishStatus.PUBLISHED,
      createdById: adminId,
      updatedById: adminId,
    },
  });

  const lesson1 = await prisma.lesson.upsert({
    where: {
      chapterId_orderIndex: {
        chapterId: chapter1.id,
        orderIndex: 1,
      },
    },
    update: {
      learningPathId: learningPath.id,
      chapterId: chapter1.id,
      title: "Buổi 1 - Số hữu tỉ",
      shortDescription: "Khái niệm số hữu tỉ và cách biểu diễn trên trục số.",
      examOpenAt: addDays(now, -1),
      videoUrl: "https://youtube.com/example-toan7-buoi1",
      completionMinScore: new Prisma.Decimal("7"),
      trialEnabled: true,
      status: PublishStatus.PUBLISHED,
      updatedById: adminId,
    },
    create: {
      id: ids.lesson1,
      learningPathId: learningPath.id,
      chapterId: chapter1.id,
      orderIndex: 1,
      title: "Buổi 1 - Số hữu tỉ",
      shortDescription: "Khái niệm số hữu tỉ và cách biểu diễn trên trục số.",
      examOpenAt: addDays(now, -1),
      videoUrl: "https://youtube.com/example-toan7-buoi1",
      completionMinScore: new Prisma.Decimal("7"),
      trialEnabled: true,
      status: PublishStatus.PUBLISHED,
      createdById: adminId,
      updatedById: adminId,
    },
  });

  const lesson2 = await prisma.lesson.upsert({
    where: {
      chapterId_orderIndex: {
        chapterId: chapter1.id,
        orderIndex: 2,
      },
    },
    update: {
      learningPathId: learningPath.id,
      chapterId: chapter1.id,
      title: "Buổi 2 - Lũy thừa của số hữu tỉ",
      shortDescription: "Quy tắc nhân, chia và lũy thừa của số hữu tỉ.",
      examOpenAt: addDays(now, 7),
      videoUrl: "https://youtube.com/example-toan7-buoi2",
      completionMinScore: new Prisma.Decimal("7"),
      trialEnabled: false,
      status: PublishStatus.PUBLISHED,
      updatedById: adminId,
    },
    create: {
      id: ids.lesson2,
      learningPathId: learningPath.id,
      chapterId: chapter1.id,
      orderIndex: 2,
      title: "Buổi 2 - Lũy thừa của số hữu tỉ",
      shortDescription: "Quy tắc nhân, chia và lũy thừa của số hữu tỉ.",
      examOpenAt: addDays(now, 7),
      videoUrl: "https://youtube.com/example-toan7-buoi2",
      completionMinScore: new Prisma.Decimal("7"),
      trialEnabled: false,
      status: PublishStatus.PUBLISHED,
      createdById: adminId,
      updatedById: adminId,
    },
  });

  await prisma.lessonMaterial.upsert({
    where: { id: ids.material1 },
    update: {
      lessonId: lesson1.id,
      type: LessonMaterialType.RICH_TEXT,
      title: "Phiếu ghi nhớ số hữu tỉ",
      contentJson: docText(
        "Số hữu tỉ là số viết được dưới dạng phân số a/b với b khác 0.",
      ),
      sortOrder: 1,
    },
    create: {
      id: ids.material1,
      lessonId: lesson1.id,
      type: LessonMaterialType.RICH_TEXT,
      title: "Phiếu ghi nhớ số hữu tỉ",
      contentJson: docText(
        "Số hữu tỉ là số viết được dưới dạng phân số a/b với b khác 0.",
      ),
      sortOrder: 1,
    },
  });

  await prisma.lessonMaterial.upsert({
    where: { id: ids.material2 },
    update: {
      lessonId: lesson2.id,
      type: LessonMaterialType.RICH_TEXT,
      title: "Phiếu ghi nhớ lũy thừa",
      contentJson: docText("Khi nhân hai lũy thừa cùng cơ số, ta cộng các số mũ."),
      sortOrder: 1,
    },
    create: {
      id: ids.material2,
      lessonId: lesson2.id,
      type: LessonMaterialType.RICH_TEXT,
      title: "Phiếu ghi nhớ lũy thừa",
      contentJson: docText("Khi nhân hai lũy thừa cùng cơ số, ta cộng các số mũ."),
      sortOrder: 1,
    },
  });

  await prisma.lessonSummary.upsert({
    where: { lessonId: lesson1.id },
    update: {
      contentJson: docText(
        "Tóm tắt: Số hữu tỉ biểu diễn được dưới dạng phân số và có thể so sánh trên trục số.",
      ),
      source: ContentSource.ADMIN,
      reviewStatus: ReviewStatus.APPROVED,
      updatedById: adminId,
    },
    create: {
      id: ids.summary1,
      lessonId: lesson1.id,
      contentJson: docText(
        "Tóm tắt: Số hữu tỉ biểu diễn được dưới dạng phân số và có thể so sánh trên trục số.",
      ),
      source: ContentSource.ADMIN,
      reviewStatus: ReviewStatus.APPROVED,
      createdById: adminId,
      updatedById: adminId,
    },
  });

  await prisma.lessonSummary.upsert({
    where: { lessonId: lesson2.id },
    update: {
      contentJson: docText(
        "Tóm tắt: Lũy thừa giúp viết gọn tích nhiều thừa số bằng nhau.",
      ),
      source: ContentSource.ADMIN,
      reviewStatus: ReviewStatus.APPROVED,
      updatedById: adminId,
    },
    create: {
      id: ids.summary2,
      lessonId: lesson2.id,
      contentJson: docText(
        "Tóm tắt: Lũy thừa giúp viết gọn tích nhiều thừa số bằng nhau.",
      ),
      source: ContentSource.ADMIN,
      reviewStatus: ReviewStatus.APPROVED,
      createdById: adminId,
      updatedById: adminId,
    },
  });

  return { learningPath, lesson1, lesson2 };
}

async function seedDocument(adminId: string, lessonId: string) {
  const content = [
    "Số hữu tỉ là số viết được dưới dạng a/b, trong đó a và b là số nguyên và b khác 0.",
    "Khi so sánh hai số hữu tỉ, có thể quy đồng mẫu dương rồi so sánh tử số.",
    "Trên trục số, số hữu tỉ âm nằm bên trái số 0 và số hữu tỉ dương nằm bên phải số 0.",
  ];

  const file = await prisma.file.upsert({
    where: { objectKey: "seed/dev/lesson-document/toan-7-buoi-1.pdf" },
    update: {
      purpose: FilePurpose.LESSON_DOCUMENT,
      bucket: "learning-path-dev",
      originalName: "toan-7-buoi-1.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4096n,
      visibility: FileVisibility.PRIVATE,
      status: FileStatus.READY,
      uploadedById: adminId,
      metadataJson: { seed: true },
    },
    create: {
      id: ids.documentFile,
      purpose: FilePurpose.LESSON_DOCUMENT,
      bucket: "learning-path-dev",
      objectKey: "seed/dev/lesson-document/toan-7-buoi-1.pdf",
      originalName: "toan-7-buoi-1.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4096n,
      visibility: FileVisibility.PRIVATE,
      status: FileStatus.READY,
      uploadedById: adminId,
      metadataJson: { seed: true },
    },
  });

  const document = await prisma.lessonDocument.upsert({
    where: { id: ids.document },
    update: {
      lessonId,
      fileId: file.id,
      title: "Tài liệu mẫu - Số hữu tỉ",
      status: DocumentStatus.READY,
      extractedText: content.join("\n\n"),
      contentHash: hashText(content.join("|")),
      chunkCount: content.length,
      processedAt: new Date(),
      embeddingProvider: AiProviderName.OPENAI,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      metadataJson: { seed: true },
    },
    create: {
      id: ids.document,
      lessonId,
      fileId: file.id,
      title: "Tài liệu mẫu - Số hữu tỉ",
      status: DocumentStatus.READY,
      extractedText: content.join("\n\n"),
      contentHash: hashText(content.join("|")),
      chunkCount: content.length,
      processedAt: new Date(),
      embeddingProvider: AiProviderName.OPENAI,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      metadataJson: { seed: true },
    },
  });

  const chunkIds = [ids.chunk1, ids.chunk2, ids.chunk3];
  for (const [index, chunkContent] of content.entries()) {
    await prisma.documentChunk.upsert({
      where: {
        documentId_chunkIndex: {
          documentId: document.id,
          chunkIndex: index,
        },
      },
      update: {
        lessonId,
        content: chunkContent,
        contentHash: hashText(chunkContent),
        tokenCount: 32,
        embeddingProvider: AiProviderName.OPENAI,
        embeddingModel: "text-embedding-3-small",
        embeddingDimensions: 1536,
        metadataJson: { seed: true, pageStart: index + 1, pageEnd: index + 1 },
      },
      create: {
        id: chunkIds[index],
        documentId: document.id,
        lessonId,
        chunkIndex: index,
        content: chunkContent,
        contentHash: hashText(chunkContent),
        tokenCount: 32,
        embeddingProvider: AiProviderName.OPENAI,
        embeddingModel: "text-embedding-3-small",
        embeddingDimensions: 1536,
        metadataJson: { seed: true, pageStart: index + 1, pageEnd: index + 1 },
      },
    });
  }

  return document;
}

async function seedQuizFlashcardAndTest(
  adminId: string,
  studentId: string,
  lessonId: string,
) {
  const quizSet = await prisma.quizSet.upsert({
    where: { id: ids.quizSet },
    update: {
      lessonId,
      title: "Quiz cơ bản",
      difficulty: Difficulty.EASY,
      questionCount: 3,
      sortOrder: 1,
      updatedById: adminId,
    },
    create: {
      id: ids.quizSet,
      lessonId,
      title: "Quiz cơ bản",
      difficulty: Difficulty.EASY,
      source: ContentSource.ADMIN,
      reviewStatus: ReviewStatus.APPROVED,
      questionCount: 3,
      sortOrder: 1,
      createdById: adminId,
      updatedById: adminId,
    },
  });

  await prisma.quizQuestion.upsert({
    where: { id: ids.quizQuestion1 },
    update: {
      quizSetId: quizSet.id,
      lessonId,
      questionType: QuestionType.MULTIPLE_CHOICE,
      questionJson: textNode("Số nào sau đây là số hữu tỉ?"),
      optionsJson: multipleChoiceOptions([
        { id: "A", text: "1/2" },
        { id: "B", text: "sqrt(2)" },
        { id: "C", text: "pi" },
      ]),
      correctAnswerJson: { optionId: "A" },
      hintJson: textNode("Số hữu tỉ viết được dưới dạng phân số."),
      difficulty: Difficulty.EASY,
      sortOrder: 1,
    },
    create: {
      id: ids.quizQuestion1,
      quizSetId: quizSet.id,
      lessonId,
      questionType: QuestionType.MULTIPLE_CHOICE,
      questionJson: textNode("Số nào sau đây là số hữu tỉ?"),
      optionsJson: multipleChoiceOptions([
        { id: "A", text: "1/2" },
        { id: "B", text: "sqrt(2)" },
        { id: "C", text: "pi" },
      ]),
      correctAnswerJson: { optionId: "A" },
      hintJson: textNode("Số hữu tỉ viết được dưới dạng phân số."),
      difficulty: Difficulty.EASY,
      reviewStatus: ReviewStatus.APPROVED,
      sortOrder: 1,
    },
  });

  await prisma.quizQuestion.upsert({
    where: { id: ids.quizQuestion2 },
    update: {
      quizSetId: quizSet.id,
      lessonId,
      questionType: QuestionType.TRUE_FALSE,
      questionJson: textNode("Mọi số nguyên đều là số hữu tỉ."),
      correctAnswerJson: { value: true },
      difficulty: Difficulty.EASY,
      sortOrder: 2,
    },
    create: {
      id: ids.quizQuestion2,
      quizSetId: quizSet.id,
      lessonId,
      questionType: QuestionType.TRUE_FALSE,
      questionJson: textNode("Mọi số nguyên đều là số hữu tỉ."),
      correctAnswerJson: { value: true },
      difficulty: Difficulty.EASY,
      reviewStatus: ReviewStatus.APPROVED,
      sortOrder: 2,
    },
  });

  await prisma.quizQuestion.upsert({
    where: { id: ids.quizQuestion3 },
    update: {
      quizSetId: quizSet.id,
      lessonId,
      questionType: QuestionType.TEXT_INPUT,
      questionJson: textNode("Viết số hữu tỉ âm đơn giản có tử là -1 và mẫu là 2."),
      correctAnswerJson: { text: "-1/2" },
      gradingConfigJson: {
        acceptedAnswers: ["-1/2", "-0.5"],
        caseSensitive: false,
        trimWhitespace: true,
      },
      difficulty: Difficulty.EASY,
      sortOrder: 3,
    },
    create: {
      id: ids.quizQuestion3,
      quizSetId: quizSet.id,
      lessonId,
      questionType: QuestionType.TEXT_INPUT,
      questionJson: textNode("Viết số hữu tỉ âm đơn giản có tử là -1 và mẫu là 2."),
      correctAnswerJson: { text: "-1/2" },
      gradingConfigJson: {
        acceptedAnswers: ["-1/2", "-0.5"],
        caseSensitive: false,
        trimWhitespace: true,
      },
      difficulty: Difficulty.EASY,
      reviewStatus: ReviewStatus.APPROVED,
      sortOrder: 3,
    },
  });

  const flashcardSet = await prisma.flashcardSet.upsert({
    where: { id: ids.flashcardSet },
    update: {
      lessonId,
      title: "Flashcard số hữu tỉ",
      difficulty: Difficulty.EASY,
      cardCount: 3,
      sortOrder: 1,
      updatedById: adminId,
    },
    create: {
      id: ids.flashcardSet,
      lessonId,
      title: "Flashcard số hữu tỉ",
      difficulty: Difficulty.EASY,
      source: ContentSource.ADMIN,
      reviewStatus: ReviewStatus.APPROVED,
      cardCount: 3,
      sortOrder: 1,
      createdById: adminId,
      updatedById: adminId,
    },
  });

  const flashcards = [
    [ids.flashcard1, "Số hữu tỉ", "Số viết được dưới dạng a/b với b khác 0."],
    [ids.flashcard2, "Quy đồng mẫu", "Đưa hai phân số về cùng mẫu dương để so sánh."],
    [ids.flashcard3, "Số hữu tỉ âm", "Nằm bên trái số 0 trên trục số."],
  ] as const;

  for (const [index, [id, front, back]] of flashcards.entries()) {
    await prisma.flashcard.upsert({
      where: { id },
      update: {
        flashcardSetId: flashcardSet.id,
        lessonId,
        frontJson: textNode(front),
        backJson: textNode(back),
        difficulty: Difficulty.EASY,
        sortOrder: index + 1,
      },
      create: {
        id,
        flashcardSetId: flashcardSet.id,
        lessonId,
        frontJson: textNode(front),
        backJson: textNode(back),
        difficulty: Difficulty.EASY,
        reviewStatus: ReviewStatus.APPROVED,
        sortOrder: index + 1,
      },
    });
  }

  await prisma.flashcardProgress.upsert({
    where: {
      studentUserId_flashcardId: {
        studentUserId: studentId,
        flashcardId: ids.flashcard1,
      },
    },
    update: {
      lessonId,
      isKnown: true,
      lastReviewedAt: new Date(),
      reviewCount: 1,
    },
    create: {
      id: ids.flashcardProgress,
      studentUserId: studentId,
      lessonId,
      flashcardId: ids.flashcard1,
      isKnown: true,
      lastReviewedAt: new Date(),
      reviewCount: 1,
    },
  });

  await prisma.favorite.upsert({
    where: {
      studentUserId_targetType_targetId: {
        studentUserId: studentId,
        targetType: FavoriteTargetType.FLASHCARD,
        targetId: ids.flashcard1,
      },
    },
    update: {
      lessonId,
    },
    create: {
      id: ids.favorite,
      studentUserId: studentId,
      lessonId,
      targetType: FavoriteTargetType.FLASHCARD,
      targetId: ids.flashcard1,
    },
  });

  const testSet = await prisma.testSet.upsert({
    where: { id: ids.testSet },
    update: {
      lessonId,
      title: "Bài kiểm tra ngắn",
      durationSeconds: 900,
      difficulty: Difficulty.MIXED,
      difficultyRatioJson: { easy: 0.6, medium: 0.2, hard: 0.2 },
      questionCount: 5,
      totalScore: new Prisma.Decimal("10"),
      sortOrder: 1,
      updatedById: adminId,
    },
    create: {
      id: ids.testSet,
      lessonId,
      title: "Bài kiểm tra ngắn",
      durationSeconds: 900,
      difficulty: Difficulty.MIXED,
      difficultyRatioJson: { easy: 0.6, medium: 0.2, hard: 0.2 },
      source: ContentSource.ADMIN,
      reviewStatus: ReviewStatus.APPROVED,
      questionCount: 5,
      totalScore: new Prisma.Decimal("10"),
      sortOrder: 1,
      createdById: adminId,
      updatedById: adminId,
    },
  });

  const testQuestions = [
    [
      ids.testQuestion1,
      QuestionType.MULTIPLE_CHOICE,
      "Số nào là số hữu tỉ?",
      { optionId: "A" },
      Difficulty.EASY,
    ],
    [
      ids.testQuestion2,
      QuestionType.TRUE_FALSE,
      "Số 0 là số hữu tỉ.",
      { value: true },
      Difficulty.EASY,
    ],
    [
      ids.testQuestion3,
      QuestionType.TEXT_INPUT,
      "Kết quả của 1/2 + 1/2 là gì?",
      { text: "1" },
      Difficulty.EASY,
    ],
    [
      ids.testQuestion4,
      QuestionType.MULTIPLE_CHOICE,
      "Số hữu tỉ âm nằm ở đâu so với 0?",
      { optionId: "B" },
      Difficulty.MEDIUM,
    ],
    [
      ids.testQuestion5,
      QuestionType.TEXT_INPUT,
      "Viết một số hữu tỉ lớn hơn 0 và nhỏ hơn 1.",
      { accepted: ["1/2"] },
      Difficulty.HARD,
    ],
  ] as const;

  for (const [
    index,
    [id, questionType, question, correctAnswer, difficulty],
  ] of testQuestions.entries()) {
    await prisma.testQuestion.upsert({
      where: { id },
      update: {
        testSetId: testSet.id,
        lessonId,
        questionType,
        questionJson: textNode(question),
        optionsJson:
          questionType === QuestionType.MULTIPLE_CHOICE
            ? multipleChoiceOptions([
                { id: "A", text: "1/2" },
                { id: "B", text: "Bên trái 0" },
                { id: "C", text: "Không xác định" },
              ])
            : undefined,
        correctAnswerJson: correctAnswer,
        gradingConfigJson:
          questionType === QuestionType.TEXT_INPUT
            ? { acceptedAnswers: ["1", "1/2", "0.5"], trimWhitespace: true }
            : undefined,
        points: new Prisma.Decimal("2"),
        difficulty,
        sortOrder: index + 1,
      },
      create: {
        id,
        testSetId: testSet.id,
        lessonId,
        questionType,
        questionJson: textNode(question),
        optionsJson:
          questionType === QuestionType.MULTIPLE_CHOICE
            ? multipleChoiceOptions([
                { id: "A", text: "1/2" },
                { id: "B", text: "Bên trái 0" },
                { id: "C", text: "Không xác định" },
              ])
            : undefined,
        correctAnswerJson: correctAnswer,
        gradingConfigJson:
          questionType === QuestionType.TEXT_INPUT
            ? { acceptedAnswers: ["1", "1/2", "0.5"], trimWhitespace: true }
            : undefined,
        points: new Prisma.Decimal("2"),
        difficulty,
        reviewStatus: ReviewStatus.APPROVED,
        sortOrder: index + 1,
      },
    });
  }

  await prisma.quizAttempt.upsert({
    where: { id: ids.quizAttempt },
    update: {
      studentUserId: studentId,
      lessonId,
      quizSetId: quizSet.id,
      status: AttemptStatus.SUBMITTED,
      submittedAt: new Date(),
      correctCount: 1,
      wrongCount: 0,
      totalCount: 1,
    },
    create: {
      id: ids.quizAttempt,
      studentUserId: studentId,
      lessonId,
      quizSetId: quizSet.id,
      status: AttemptStatus.SUBMITTED,
      submittedAt: new Date(),
      correctCount: 1,
      wrongCount: 0,
      totalCount: 1,
    },
  });

  await prisma.quizAttemptAnswer.upsert({
    where: {
      attemptId_questionId: {
        attemptId: ids.quizAttempt,
        questionId: ids.quizQuestion1,
      },
    },
    update: {
      answerJson: { optionId: "A" },
      isCorrect: true,
    },
    create: {
      id: ids.quizAnswer1,
      attemptId: ids.quizAttempt,
      questionId: ids.quizQuestion1,
      answerJson: { optionId: "A" },
      isCorrect: true,
    },
  });

  await prisma.testAttempt.upsert({
    where: { id: ids.testAttempt },
    update: {
      studentUserId: studentId,
      lessonId,
      testSetId: testSet.id,
      status: AttemptStatus.GRADED,
      submittedAt: new Date(),
      durationSeconds: 720,
      score: new Prisma.Decimal("8"),
      correctCount: 4,
      wrongCount: 1,
      totalCount: 5,
      isBestForLesson: true,
    },
    create: {
      id: ids.testAttempt,
      studentUserId: studentId,
      lessonId,
      testSetId: testSet.id,
      status: AttemptStatus.GRADED,
      submittedAt: new Date(),
      durationSeconds: 720,
      score: new Prisma.Decimal("8"),
      correctCount: 4,
      wrongCount: 1,
      totalCount: 5,
      isBestForLesson: true,
    },
  });

  await prisma.testAttemptAnswer.upsert({
    where: {
      attemptId_questionId: {
        attemptId: ids.testAttempt,
        questionId: ids.testQuestion1,
      },
    },
    update: {
      answerJson: { optionId: "A" },
      isCorrect: true,
      pointsAwarded: new Prisma.Decimal("2"),
    },
    create: {
      id: ids.testAnswer1,
      attemptId: ids.testAttempt,
      questionId: ids.testQuestion1,
      answerJson: { optionId: "A" },
      isCorrect: true,
      pointsAwarded: new Prisma.Decimal("2"),
    },
  });

  return { quizSet, testSet };
}

async function seedPaymentAndProgress(
  studentId: string,
  parentId: string,
  learningPathId: string,
  lessonId: string,
) {
  const paidAt = addDays(new Date(), -1);

  const discount = await prisma.discountCode.upsert({
    where: { code: "WELCOME10" },
    update: {
      type: DiscountType.PERCENT,
      value: 10,
      maxUses: 100,
      usedCount: 1,
      isActive: true,
    },
    create: {
      id: ids.discountCode,
      code: "WELCOME10",
      type: DiscountType.PERCENT,
      value: 10,
      maxUses: 100,
      usedCount: 1,
      isActive: true,
    },
  });

  const payment = await prisma.payment.upsert({
    where: { providerOrderCode: "SEED-PAYOS-TOAN7-0001" },
    update: {
      provider: PaymentProvider.PAYOS,
      status: PaymentStatus.PAID,
      payerUserId: parentId,
      studentUserId: studentId,
      learningPathId,
      discountCodeId: discount.id,
      idempotencyKey: "seed-payment-toan7-student1",
      providerPaymentLinkId: "seed-payment-link-0001",
      checkoutUrl: "https://payos.example/seed-payment-toan7",
      qrCode: "seed-qr-code-toan7",
      amountVnd: 1_500_000,
      originalAmountVnd: 2_000_000,
      discountAmountVnd: 500_000,
      paidAt,
      expiredAt: addDays(paidAt, 1),
      rawResponseJson: { seed: true, status: "PAID" },
    },
    create: {
      id: ids.payment,
      provider: PaymentProvider.PAYOS,
      status: PaymentStatus.PAID,
      payerUserId: parentId,
      studentUserId: studentId,
      learningPathId,
      discountCodeId: discount.id,
      idempotencyKey: "seed-payment-toan7-student1",
      providerOrderCode: "SEED-PAYOS-TOAN7-0001",
      providerPaymentLinkId: "seed-payment-link-0001",
      checkoutUrl: "https://payos.example/seed-payment-toan7",
      qrCode: "seed-qr-code-toan7",
      amountVnd: 1_500_000,
      originalAmountVnd: 2_000_000,
      discountAmountVnd: 500_000,
      paidAt,
      expiredAt: addDays(paidAt, 1),
      rawResponseJson: { seed: true, status: "PAID" },
    },
  });

  await prisma.paymentWebhookLog.upsert({
    where: { eventId: "seed-payos-event-0001" },
    update: {
      providerOrderCode: payment.providerOrderCode,
      rawPayloadJson: {
        seed: true,
        orderCode: payment.providerOrderCode,
        status: "PAID",
      },
      signature: "seed-signature-placeholder",
      verified: true,
      processed: true,
      processedAt: paidAt,
    },
    create: {
      id: ids.webhookLog,
      provider: PaymentProvider.PAYOS,
      eventId: "seed-payos-event-0001",
      providerOrderCode: payment.providerOrderCode,
      rawPayloadJson: {
        seed: true,
        orderCode: payment.providerOrderCode,
        status: "PAID",
      },
      signature: "seed-signature-placeholder",
      verified: true,
      processed: true,
      receivedAt: paidAt,
      processedAt: paidAt,
    },
  });

  await prisma.enrollment.upsert({
    where: { id: ids.enrollment },
    update: {
      studentUserId: studentId,
      learningPathId,
      paidByUserId: parentId,
      paymentId: payment.id,
      startsAt: paidAt,
      expiresAt: addMonths(paidAt, 12),
    },
    create: {
      id: ids.enrollment,
      studentUserId: studentId,
      learningPathId,
      paidByUserId: parentId,
      paymentId: payment.id,
      startsAt: paidAt,
      expiresAt: addMonths(paidAt, 12),
    },
  });

  await prisma.lessonProgress.upsert({
    where: {
      studentUserId_lessonId: {
        studentUserId: studentId,
        lessonId,
      },
    },
    update: {
      status: LessonProgressStatus.COMPLETED,
      bestTestAttemptId: ids.testAttempt,
      bestScore: new Prisma.Decimal("8"),
      bestDurationSeconds: 720,
      completedAt: paidAt,
      xpAwarded: true,
    },
    create: {
      id: ids.lessonProgress,
      studentUserId: studentId,
      lessonId,
      status: LessonProgressStatus.COMPLETED,
      bestTestAttemptId: ids.testAttempt,
      bestScore: new Prisma.Decimal("8"),
      bestDurationSeconds: 720,
      completedAt: paidAt,
      xpAwarded: true,
    },
  });

  await prisma.xpEvent.upsert({
    where: { idempotencyKey: "seed-xp-lesson-completed-student1-lesson1" },
    update: {
      studentUserId: studentId,
      lessonId,
      source: XpEventSource.LESSON_COMPLETED,
      sourceRefId: ids.lessonProgress,
      xp: 120,
      metadataJson: { seed: true, reason: "lesson_completed" },
    },
    create: {
      id: ids.xpEvent,
      studentUserId: studentId,
      lessonId,
      source: XpEventSource.LESSON_COMPLETED,
      sourceRefId: ids.lessonProgress,
      idempotencyKey: "seed-xp-lesson-completed-student1-lesson1",
      xp: 120,
      metadataJson: { seed: true, reason: "lesson_completed" },
    },
  });

  return { payment };
}

async function seedCommunication(studentId: string, parentId: string, lessonId: string) {
  await prisma.notification.upsert({
    where: { id: ids.studentNotification },
    update: {
      recipientUserId: studentId,
      kind: NotificationKind.SYSTEM,
      type: NotificationType.TEST_OPENED,
      title: "Bài kiểm tra đã mở",
      body: "Bài kiểm tra Buổi 1 - Số hữu tỉ đã mở.",
      dataJson: { lessonId, seed: true },
    },
    create: {
      id: ids.studentNotification,
      recipientUserId: studentId,
      kind: NotificationKind.SYSTEM,
      type: NotificationType.TEST_OPENED,
      title: "Bài kiểm tra đã mở",
      body: "Bài kiểm tra Buổi 1 - Số hữu tỉ đã mở.",
      dataJson: { lessonId, seed: true },
    },
  });

  await prisma.notificationDelivery.upsert({
    where: {
      notificationId_channel: {
        notificationId: ids.studentNotification,
        channel: NotificationChannel.IN_APP,
      },
    },
    update: {
      status: DeliveryStatus.SENT,
      sentAt: new Date(),
    },
    create: {
      id: ids.studentNotificationDelivery,
      notificationId: ids.studentNotification,
      channel: NotificationChannel.IN_APP,
      status: DeliveryStatus.SENT,
      sentAt: new Date(),
    },
  });

  await prisma.notification.upsert({
    where: { id: ids.parentNotification },
    update: {
      recipientUserId: parentId,
      kind: NotificationKind.SYSTEM,
      type: NotificationType.LESSON_COMPLETED,
      title: "Con bạn đã hoàn thành buổi học",
      body: "Nguyễn Văn An đã hoàn thành Buổi 1 - Số hữu tỉ.",
      dataJson: { lessonId, studentUserId: studentId, seed: true },
    },
    create: {
      id: ids.parentNotification,
      recipientUserId: parentId,
      kind: NotificationKind.SYSTEM,
      type: NotificationType.LESSON_COMPLETED,
      title: "Con bạn đã hoàn thành buổi học",
      body: "Nguyễn Văn An đã hoàn thành Buổi 1 - Số hữu tỉ.",
      dataJson: { lessonId, studentUserId: studentId, seed: true },
    },
  });

  await prisma.notificationDelivery.upsert({
    where: {
      notificationId_channel: {
        notificationId: ids.parentNotification,
        channel: NotificationChannel.IN_APP,
      },
    },
    update: {
      status: DeliveryStatus.SENT,
      sentAt: new Date(),
    },
    create: {
      id: ids.parentNotificationDelivery,
      notificationId: ids.parentNotification,
      channel: NotificationChannel.IN_APP,
      status: DeliveryStatus.SENT,
      sentAt: new Date(),
    },
  });

  await prisma.report.upsert({
    where: { id: ids.report },
    update: {
      reporterUserId: studentId,
      targetType: ReportTargetType.QUIZ_QUESTION,
      targetId: ids.quizQuestion1,
      lessonId,
      reason: "Đáp án sai",
      description: "Em nghĩ đáp án đúng là B.",
      status: ReportStatus.OPEN,
    },
    create: {
      id: ids.report,
      reporterUserId: studentId,
      targetType: ReportTargetType.QUIZ_QUESTION,
      targetId: ids.quizQuestion1,
      lessonId,
      reason: "Đáp án sai",
      description: "Em nghĩ đáp án đúng là B.",
      status: ReportStatus.OPEN,
    },
  });

  await prisma.studentNote.upsert({
    where: { id: ids.studentNote },
    update: {
      studentUserId: studentId,
      lessonId,
      contentJson: docText("Cần ôn lại cách quy đồng mẫu số."),
    },
    create: {
      id: ids.studentNote,
      studentUserId: studentId,
      lessonId,
      contentJson: docText("Cần ôn lại cách quy đồng mẫu số."),
    },
  });

  await prisma.lessonVideoComment.upsert({
    where: { id: ids.lessonVideoComment },
    update: {
      studentUserId: studentId,
      lessonId,
      contentJson: docText("Đoạn giải thích trục số rất dễ hiểu."),
    },
    create: {
      id: ids.lessonVideoComment,
      studentUserId: studentId,
      lessonId,
      contentJson: docText("Đoạn giải thích trục số rất dễ hiểu."),
    },
  });
}

async function seedNews(adminId: string) {
  await prisma.newsItem.upsert({
    where: { slug: "khai-giang-lop-toan-7" },
    update: {
      type: NewsType.NEWS,
      title: "Khai giảng lớp Toán 7",
      contentJson: docText("Lớp Toán 7 mẫu đã sẵn sàng để học sinh trải nghiệm."),
      status: PublishStatus.PUBLISHED,
      updatedById: adminId,
      publishedAt: addDays(new Date(), -2),
    },
    create: {
      id: ids.newsItem,
      type: NewsType.NEWS,
      title: "Khai giảng lớp Toán 7",
      slug: "khai-giang-lop-toan-7",
      contentJson: docText("Lớp Toán 7 mẫu đã sẵn sàng để học sinh trải nghiệm."),
      status: PublishStatus.PUBLISHED,
      createdById: adminId,
      updatedById: adminId,
      publishedAt: addDays(new Date(), -2),
    },
  });
}

async function seedAIModels() {
  const models = [
    { provider: 'OPENAI', externalKey: 'gpt-5.6-sol', displayName: 'GPT-5.6 Sol', in: 0.005, out: 0.03 },
    { provider: 'OPENAI', externalKey: 'gpt-5.6-terra', displayName: 'GPT-5.6 Terra', in: 0.002, out: 0.012 },
    { provider: 'OPENAI', externalKey: 'gpt-5.6-luna', displayName: 'GPT-5.6 Luna', in: 0.0002, out: 0.0012 },
    { provider: 'OPENAI', externalKey: 'gpt-5.5', displayName: 'GPT-5.5', in: 0.005, out: 0.03 },
    { provider: 'OPENAI', externalKey: 'gpt-5.5-pro', displayName: 'GPT-5.5 Pro', in: 0.03, out: 0.18 },
    { provider: 'OPENAI', externalKey: 'gpt-5.4', displayName: 'GPT-5.4', in: 0.0025, out: 0.015 },
    { provider: 'OPENAI', externalKey: 'gpt-5.4-pro', displayName: 'GPT-5.4 Pro', in: 0.03, out: 0.18 },
    { provider: 'OPENAI', externalKey: 'gpt-5.4-mini', displayName: 'GPT-5.4 Mini', in: 0.00075, out: 0.0045 },
    { provider: 'OPENAI', externalKey: 'gpt-5.4-nano', displayName: 'GPT-5.4 Nano', in: 0.0002, out: 0.00125 },
    { provider: 'OPENAI', externalKey: 'gpt-4.1', displayName: 'GPT-4.1', in: 0.002, out: 0.008 },
    { provider: 'OPENAI', externalKey: 'gpt-4.1-mini', displayName: 'GPT-4.1 Mini', in: 0.0002, out: 0.001 },
    { provider: 'OPENAI', externalKey: 'gpt-4.1-nano', displayName: 'GPT-4.1 Nano', in: 0.0001, out: 0.0005 },
    { provider: 'OPENAI', externalKey: 'o3', displayName: 'o3', in: 0.002, out: 0.008 },
    { provider: 'OPENAI', externalKey: 'o3-pro', displayName: 'o3 Pro', in: 0.015, out: 0.06 },
    { provider: 'OPENAI', externalKey: 'o4-mini', displayName: 'o4 Mini', in: 0.0011, out: 0.0044 },
    { provider: 'GEMINI', externalKey: 'gemini-3.6-flash', displayName: 'Gemini 3.6 Flash', in: 0.0015, out: 0.0075 },
    { provider: 'GEMINI', externalKey: 'gemini-3.5-flash', displayName: 'Gemini 3.5 Flash', in: 0.0015, out: 0.009 },
    { provider: 'GEMINI', externalKey: 'gemini-3.5-flash-lite', displayName: 'Gemini 3.5 Flash-Lite', in: 0.0003, out: 0.0025 },
    { provider: 'GEMINI', externalKey: 'gemini-3.1-pro', displayName: 'Gemini 3.1 Pro', in: 0.002, out: 0.012 },
    { provider: 'GEMINI', externalKey: 'gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash-Lite', in: 0.00025, out: 0.0015 },
    { provider: 'GEMINI', externalKey: 'gemini-3-flash', displayName: 'Gemini 3 Flash', in: 0.0005, out: 0.003 },
    { provider: 'GEMINI', externalKey: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', in: 0.00125, out: 0.010 },
    { provider: 'GEMINI', externalKey: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', in: 0.0003, out: 0.0025 },
    { provider: 'GEMINI', externalKey: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash-Lite', in: 0.0001, out: 0.0005 }
  ];

  for (const m of models) {
    const item = await prisma.providerCatalogItem.upsert({
      where: {
        category_provider_externalKey: {
          category: 'AI_MODEL',
          provider: m.provider as any,
          externalKey: m.externalKey,
        }
      },
      update: {
        displayName: m.displayName,
        status: 'ACTIVE',
        capabilitiesJson: ["SUMMARY","QUIZ","FLASHCARD","TEST"],
        credentialEnvVar: m.provider === 'OPENAI' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY',
      },
      create: {
        category: 'AI_MODEL',
        provider: m.provider as any,
        externalKey: m.externalKey,
        displayName: m.displayName,
        status: 'ACTIVE',
        capabilitiesJson: ["SUMMARY","QUIZ","FLASHCARD","TEST"],
        credentialEnvVar: m.provider === 'OPENAI' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY',
      }
    });

    const priceVersion = await prisma.providerPriceVersion.findFirst({
      where: { catalogItemId: item.id }
    });

    if (priceVersion) {
      await prisma.providerPriceRate.deleteMany({
        where: { priceVersionId: priceVersion.id }
      });
      await prisma.providerPriceRate.createMany({
        data: [
          { priceVersionId: priceVersion.id, metric: 'INPUT_TOKEN', unitSize: 1000, unitPriceUsd: m.in },
          { priceVersionId: priceVersion.id, metric: 'OUTPUT_TOKEN', unitSize: 1000, unitPriceUsd: m.out }
        ]
      });
    } else {
       await prisma.providerPriceVersion.create({
          data: {
             catalogItemId: item.id,
             effectiveFrom: new Date(),
             billingMode: 'TOKEN' as any,
             rates: {
                create: [
                   { metric: 'INPUT_TOKEN', unitSize: 1000, unitPriceUsd: m.in },
                   { metric: 'OUTPUT_TOKEN', unitSize: 1000, unitPriceUsd: m.out }
                ]
             }
          }
       });
    }
  }
}

async function main() {
  const { admin, student, parent } = await seedUsers();
  const { learningPath, lesson1 } = await seedLearningContent(admin.id);

  await seedDocument(admin.id, lesson1.id);
  await seedQuizFlashcardAndTest(admin.id, student.id, lesson1.id);
  await seedPaymentAndProgress(student.id, parent.id, learningPath.id, lesson1.id);
  await seedCommunication(student.id, parent.id, lesson1.id);
  await seedNews(admin.id);
  await seedAIModels();

  console.log("Seed data ready:");
  console.log("- admin@example.com / 123456");
  console.log("- student1@example.com / Student123!");
  console.log("- parent1@example.com / Parent123!");
  console.log("- Learning path: Toán 7");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
