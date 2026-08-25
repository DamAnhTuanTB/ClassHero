import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import {
  BackgroundJobStatus,
  Difficulty,
  QuestionType,
  QuizFigureStatus,
  UserRole,
} from "@prisma/client";

import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { QuizGenerationJobService } from "#api/modules/quiz/services/quiz-generation-job.service";

const LIVE_BUDGET_VND = 50_000;
const PHASE_TWO_RESERVE_VND_PER_LESSON = 2_000;
const POLL_INTERVAL_MS = 2_000;
const JOB_TIMEOUT_MS = 12 * 60_000;
const LIVE_MODEL = process.env.M9_3_LIVE_MODEL ?? "gpt-5.6-luna";

const naturalTargets = [
  {
    lessonId: "b700e523-0e2e-4168-8b6a-9a32a91123ac",
    label: "Toán 12 tập 2 · Bài 13 · Ứng dụng hình học tích phân",
  },
  {
    lessonId: "23cfdbcc-2ef8-4486-b673-ed23603ad208",
    label: "Toán 12 tập 2 · Bài 15 · Phương trình đường thẳng trong không gian",
  },
  {
    lessonId: "ca04044c-4609-4535-aa05-954ed9f21fe9",
    label: "Toán 9 tập 2 · Bài 29 · Tứ giác nội tiếp",
  },
] as const;

const figureValidationTargets = [
  {
    lessonId: "fd689ece-dc92-450a-b43e-197fd91a3f28",
    label: "Toán 9 tập 2 · Bài 28 · Đường tròn ngoại tiếp và nội tiếp tam giác",
  },
] as const;
const complexFigureTargets = figureValidationTargets;
const proofExtensionTargets = figureValidationTargets;
const liveScenario = process.env.M9_3_LIVE_SCENARIO ?? "natural";
const targets =
  liveScenario === "genuine-figures"
    ? figureValidationTargets
    : liveScenario === "complex-figure"
      ? complexFigureTargets
      : liveScenario === "proof-extension"
        ? proofExtensionTargets
        : naturalTargets;

const naturalGenerationInput = {
  questionCount: 3,
  difficulty: Difficulty.MEDIUM,
  questionTypes: [
    QuestionType.MULTIPLE_CHOICE,
    QuestionType.TRUE_FALSE,
    QuestionType.TEXT_INPUT,
  ],
  style: "student_friendly" as const,
  extraInstructions: [
    "Đây là kiểm thử quyết định hình theo nhu cầu sư phạm, không phải quota hình.",
    "Hãy tạo một câu thuần tính toán hoặc khái niệm vốn tự nhiên không cần hình.",
    "Các câu còn lại chỉ được có hình nếu chính nội dung câu hỏi thật sự cần trực quan để học sinh hiểu rõ hơn; nếu không có nhu cầu thật thì tiếp tục chọn NONE.",
    "Nếu có một câu mà lời giải cần thêm điểm hoặc đường dựng trên hình đề, dùng EXTEND_QUESTION; không được bịa thêm nhu cầu hình chỉ để đủ mode.",
    "Cả đề và lời giải phải tự đủ nghĩa và tuyệt đối không nhắc đến việc xem hay bổ sung hình.",
  ].join(" "),
  model: LIVE_MODEL,
  reasoningEffort: "medium" as const,
  maxOutputTokens: 8_000,
};

const genuineFigureGenerationInput = {
  questionCount: 3,
  difficulty: Difficulty.MEDIUM,
  questionTypes: [
    QuestionType.MULTIPLE_CHOICE,
    QuestionType.TRUE_FALSE,
    QuestionType.TEXT_INPUT,
  ],
  style: "student_friendly" as const,
  extraInstructions: [
    "Đây là kiểm thử tự nhiên về nhu cầu trực quan trong bài đường tròn ngoại tiếp và nội tiếp tam giác; không nhắm trước số hình hoặc bất kỳ figure mode nào.",
    "Biên soạn câu mới bao phủ hợp lí cả nhận biết, tính toán và suy luận hoặc dựng hình trong đúng phạm vi PDF.",
    "Mỗi câu phải tự quyết định NONE, EXTEND_QUESTION hoặc REDRAW_AS_MODEL chỉ theo nhu cầu sư phạm thực của chính câu đó; không thêm đối tượng hay bước dựng để tạo nhu cầu hình.",
    "Nếu nội dung bằng chữ và công thức đã đủ rõ thì bắt buộc chọn NONE, kể cả với câu Hình học.",
    "Problem và solution phải tự đủ nghĩa, không nhắc đến việc xem, quan sát hay bổ sung hình.",
  ].join(" "),
  model: LIVE_MODEL,
  reasoningEffort: "medium" as const,
  maxOutputTokens: 8_000,
};

const complexFigureGenerationInput = {
  questionCount: 1,
  difficulty: Difficulty.HARD,
  questionTypes: [QuestionType.TEXT_INPUT],
  style: "student_friendly" as const,
  extraInstructions: [
    "Đây là kiểm thử một câu tổng hợp có cấu hình trực quan tự nhiên trong bài đường tròn ngoại tiếp và nội tiếp tam giác.",
    "Biên soạn một câu mới về một tam giác nhọn không đặc biệt, kết hợp việc xác định tâm đường tròn ngoại tiếp từ các đường trung trực và tâm đường tròn nội tiếp từ các đường phân giác cùng các chân đường vuông góc tới ba cạnh; yêu cầu học sinh xác định hai đường tròn và giải thích đầy đủ.",
    "Mọi điểm và đường cần cho lời giải phải được định nghĩa ngay trong problem và thực sự được dùng; không lấy lại dữ kiện hay cách hỏi của ví dụ/bài tập nguồn.",
    "Đây đồng thời là ca kiểm thử một hình duy nhất: solution phải dùng đúng cấu hình đã có trong problem, không thêm điểm hoặc đường dựng riêng cho lời giải. Vì phần lời giải không cần asset riêng nên chọn NONE; hình đề không được lặp lại trong phần lời giải.",
    "Problem và solution vẫn phải tự đủ nghĩa, không nhắc đến việc xem, quan sát hay bổ sung hình.",
  ].join(" "),
  model: LIVE_MODEL,
  reasoningEffort: "medium" as const,
  maxOutputTokens: 8_000,
};

const proofExtensionGenerationInput = {
  questionCount: 1,
  difficulty: Difficulty.HARD,
  questionTypes: [QuestionType.TEXT_INPUT],
  style: "student_friendly" as const,
  extraInstructions: [
    "Đây là ca kiểm thử một bài tập chứng minh mới trong phạm vi đường tròn ngoại tiếp tam giác, không phải câu hỏi kể quy trình hay cách dựng.",
    "Biên soạn bài toán: cho tam giác nhọn có ba cạnh đôi một khác nhau, O là tâm đường tròn ngoại tiếp; M và N lần lượt là trung điểm của AB và AC. Yêu cầu chứng minh OM vuông góc AB và ON vuông góc AC.",
    "Không lấy lại câu hỏi hoặc lời giải của ví dụ/bài tập nguồn. Problem phải tự đủ nghĩa và mọi đối tượng ban đầu đều được định nghĩa rõ.",
    "Nếu hình thật sự giúp đọc cấu hình, hình đề chỉ thể hiện dữ kiện ban đầu, các đoạn OM và ON nhưng không được đánh dấu kết luận vuông góc hoặc chứa các bán kính phụ dùng trong chứng minh.",
    "Solution phải là lời giải chứng minh đầy đủ, độc lập với hình. Nếu cần minh họa các tam giác dùng để chứng minh thì dùng EXTEND_QUESTION để chỉ bổ sung các bán kính thích hợp và ký hiệu kết luận đã chứng minh trên đúng source hình đề; chỉ dùng REDRAW_AS_MODEL khi thật sự cần một biểu diễn toán học hoàn chỉnh khác.",
  ].join(" "),
  model: LIVE_MODEL,
  reasoningEffort: "medium" as const,
  maxOutputTokens: 8_000,
};

const generationInput =
  liveScenario === "genuine-figures"
    ? genuineFigureGenerationInput
    : liveScenario === "complex-figure"
      ? complexFigureGenerationInput
      : liveScenario === "proof-extension"
        ? proofExtensionGenerationInput
        : naturalGenerationInput;

async function main() {
  if (process.env.M9_3_LIVE_EXECUTE !== "1") {
    throw new Error("Set M9_3_LIVE_EXECUTE=1 to authorize paid provider calls.");
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  const startedAt = new Date();
  const results: unknown[] = [];
  let totalCostVnd = 0;
  try {
    const prisma = app.get(PrismaService);
    const generation = app.get(QuizGenerationJobService);
    const admin = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN, deletedAt: null },
      select: { id: true },
    });

    for (const target of targets) {
      const preview = await generation.previewQuiz(
        target.lessonId,
        admin.id,
        generationInput,
      );
      const phaseOneUpperBoundVnd = preview.estimatedCost.upperBoundVnd ?? 0;
      if (
        totalCostVnd + phaseOneUpperBoundVnd + PHASE_TWO_RESERVE_VND_PER_LESSON >
        LIVE_BUDGET_VND
      ) {
        results.push({
          label: target.label,
          status: "SKIPPED_BUDGET_GUARD",
          totalCostVnd,
          phaseOneUpperBoundVnd,
        });
        break;
      }

      const queued = await generation.queueQuiz(target.lessonId, admin.id, {
        ...generationInput,
        requestDraftId: preview.requestDraftId,
        requestHash: preview.requestHash,
      });
      const mainJob = await waitForMainJob(prisma, queued.jobId);
      const aiGeneration = await prisma.aiGeneration.findFirstOrThrow({
        where: { backgroundJobId: queued.jobId },
        select: { id: true, targetId: true, status: true, errorMessage: true },
      });
      if (mainJob.status !== BackgroundJobStatus.SUCCEEDED) {
        const usage = await summarizeUsage(prisma, aiGeneration.id);
        totalCostVnd += usage.costVnd;
        results.push({
          label: target.label,
          phaseOneUpperBoundVnd,
          mainJob,
          aiGeneration,
          usage,
        });
        continue;
      }

      const questions = aiGeneration.targetId
        ? await prisma.quizQuestion.findMany({
            where: {
              quizSetId: aiGeneration.targetId,
              createdAt: { gte: startedAt },
              deletedAt: null,
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              questionType: true,
              solutionFigureMode: true,
              questionJson: true,
              explanation: {
                select: { contentJson: true },
              },
            },
          })
        : [];
      const persistedFigureCount = await prisma.quizFigure.count({
        where: { aiGenerationId: aiGeneration.id, deletedAt: null },
      });
      const figures = await waitForFigures(prisma, aiGeneration.id, persistedFigureCount);
      const usage = await summarizeUsage(prisma, aiGeneration.id);
      totalCostVnd += usage.costVnd;
      results.push({
        label: target.label,
        packet: {
          pageCount: preview.context.packet.pageCount,
          sizeBytes: preview.context.packet.sizeBytes,
          estimatedInputTokens: preview.context.estimatedTokens,
        },
        phaseOneUpperBoundVnd,
        mainJob,
        aiGeneration,
        contract: summarizeContract(questions, figures, generationInput.questionCount),
        questions,
        figures,
        usage,
        runningTotalCostVnd: totalCostVnd,
      });
      if (totalCostVnd >= LIVE_BUDGET_VND) break;
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          startedAt: startedAt.toISOString(),
          scenario: liveScenario,
          model: LIVE_MODEL,
          budgetVnd: LIVE_BUDGET_VND,
          totalCostVnd,
          results,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await app.close();
  }
}

async function waitForMainJob(prisma: PrismaService, jobId: string) {
  const deadline = Date.now() + JOB_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const job = await prisma.backgroundJob.findUniqueOrThrow({
      where: { id: jobId },
      select: { id: true, status: true, errorMessage: true, result: true },
    });
    if (
      job.status === BackgroundJobStatus.SUCCEEDED ||
      job.status === BackgroundJobStatus.FAILED ||
      job.status === BackgroundJobStatus.CANCELLED
    ) {
      return job;
    }
    await wait(POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for Quiz generation job ${jobId}.`);
}

async function waitForFigures(
  prisma: PrismaService,
  aiGenerationId: string,
  expectedCount: number,
) {
  if (expectedCount === 0) return [];
  const deadline = Date.now() + JOB_TIMEOUT_MS;
  const terminal = new Set<QuizFigureStatus>([
    QuizFigureStatus.SUCCEEDED,
    QuizFigureStatus.NEEDS_REVIEW,
    QuizFigureStatus.FAILED,
  ]);
  while (Date.now() < deadline) {
    const figures = await prisma.quizFigure.findMany({
      where: { aiGenerationId, deletedAt: null },
      orderBy: [{ quizQuestionId: "asc" }, { role: "asc" }],
      select: {
        id: true,
        quizQuestionId: true,
        role: true,
        status: true,
        lastErrorCode: true,
        lastErrorMessage: true,
        currentRevision: {
          select: {
            id: true,
            latexSource: true,
            derivedFromQuestionRevisionId: true,
            deliveryFileId: true,
          },
        },
      },
    });
    if (
      figures.length === expectedCount &&
      figures.every((figure) => terminal.has(figure.status))
    ) {
      return figures;
    }
    await wait(POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for Quiz figures of ${aiGenerationId}.`);
}

async function summarizeUsage(prisma: PrismaService, aiGenerationId: string) {
  const events = await prisma.providerUsageEvent.findMany({
    where: { aiGenerationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      promptTokens: true,
      cachedInputTokens: true,
      completionTokens: true,
      totalTokens: true,
      costVnd: true,
      errorCode: true,
    },
  });
  return {
    callCount: events.length,
    costVnd: events.reduce((total, event) => total + event.costVnd, 0),
    promptTokens: events.reduce((total, event) => total + event.promptTokens, 0),
    cachedInputTokens: events.reduce(
      (total, event) => total + event.cachedInputTokens,
      0,
    ),
    completionTokens: events.reduce((total, event) => total + event.completionTokens, 0),
    events,
  };
}

function summarizeContract(
  questions: Array<{ solutionFigureMode: string }>,
  figures: Array<{
    role: string;
    status: string;
    quizQuestionId: string;
    currentRevision: {
      id: string;
      derivedFromQuestionRevisionId: string | null;
    } | null;
  }>,
  expectedQuestionCount: number,
) {
  const modes = questions.reduce<Record<string, number>>((counts, question) => {
    counts[question.solutionFigureMode] = (counts[question.solutionFigureMode] ?? 0) + 1;
    return counts;
  }, {});
  const extensionLineageValid = figures
    .filter((figure) => figure.role === "SOLUTION")
    .every((solution) => {
      const question = figures.find(
        (figure) =>
          figure.quizQuestionId === solution.quizQuestionId && figure.role === "QUESTION",
      );
      return (
        Boolean(solution.currentRevision) &&
        Boolean(question?.currentRevision) &&
        solution.currentRevision?.derivedFromQuestionRevisionId ===
          question?.currentRevision?.id
      );
    });
  return {
    questionCount: questions.length,
    modes,
    figureCount: figures.length,
    figureStatuses: figures.map((figure) => `${figure.role}:${figure.status}`),
    extensionLineageValid,
    passed:
      questions.length === expectedQuestionCount &&
      figures.every((figure) => figure.status === QuizFigureStatus.SUCCEEDED) &&
      extensionLineageValid,
  };
}

function wait(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

void main();
