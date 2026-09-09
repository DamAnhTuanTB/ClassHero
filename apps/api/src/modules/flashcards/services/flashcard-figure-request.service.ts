import { Inject, Injectable } from "@nestjs/common";
import { isAiReasoningEffort } from "@learning-path/shared";
import { AiGenerationType, AiModelPurpose } from "@prisma/client";

import { badRequestException, notFoundException } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { getTiptapText } from "#api/common/validation/rich-text-content";
import {
  AiProviderCallService,
  type ResolvedAiStructuredRequestPreview,
} from "#api/modules/ai/services/ai-provider-call.service";
import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { buildOpenAiStructuredResponseRequest } from "#api/modules/ai/utils/openai-response-request";
import type { PreviewFlashcardFigureAiDto } from "#api/modules/flashcards/dto/flashcard-figure-ai.dto";
import {
  buildFlashcardFigureStructuredInput,
  generatedFlashcardFigureSchema,
  type FlashcardFigureContext,
} from "#api/modules/flashcards/types/flashcard-figure-generation.types";
import { readFlashcardGenerationReference } from "#api/modules/flashcards/utils/flashcard-generation-reference";
import { resolveFlashcardSubject } from "#api/modules/flashcards/utils/flashcard-subject";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";

@Injectable()
export class FlashcardFigureRequestService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiProviderCallService) private readonly provider: AiProviderCallService,
    @Inject(AiModelRoutingService)
    private readonly modelRouting: AiModelRoutingService,
  ) {}

  async preview(flashcardId: string, dto: PreviewFlashcardFigureAiDto) {
    const prepared = await this.prepare(flashcardId, dto);
    const trace = await this.provider.previewStructuredRequest(
      { feature: AiGenerationType.FLASHCARD, routeSnapshot: prepared.routeSnapshot },
      prepared.request,
      generatedFlashcardFigureSchema,
    );
    return this.toPreview(
      dto,
      prepared.context,
      prepared.request,
      trace,
      prepared.routeSnapshot,
    );
  }

  async prepare(
    flashcardId: string,
    dto: PreviewFlashcardFigureAiDto,
    routeSnapshot?: AiFeatureRoute,
  ) {
    const mode = dto.mode ?? "REGENERATE";
    const preparedContext = await this.loadContext(flashcardId, mode);
    const { context } = preparedContext;
    const resolvedRoute = routeSnapshot ?? (await this.resolveRoute(dto));
    const request = buildFlashcardFigureStructuredInput({
      context,
      adminInstructions: dto.adminInstructions,
      mode,
      systemPrompt: dto.systemPrompt,
      userPrompt: dto.userPrompt,
    });
    return {
      aiGenerationId: preparedContext.aiGenerationId,
      context,
      routeSnapshot: resolvedRoute,
      request: {
        ...request,
        temperature: resolvedRoute.temperature ?? undefined,
        reasoningEffort: isAiReasoningEffort(resolvedRoute.reasoningEffort)
          ? resolvedRoute.reasoningEffort
          : undefined,
        maxTokens: resolvedRoute.maxOutputTokens ?? request.maxTokens,
        model: resolvedRoute.model,
      } satisfies AiStructuredInput,
    };
  }

  private async loadContext(
    flashcardId: string,
    mode: NonNullable<PreviewFlashcardFigureAiDto["mode"]>,
  ): Promise<{ aiGenerationId: string | null; context: FlashcardFigureContext }> {
    const card = await this.prisma.flashcard.findFirst({
      where: { id: flashcardId, deletedAt: null },
      select: {
        id: true,
        frontJson: true,
        solutionJson: true,
        sourceMetadataJson: true,
        lesson: {
          select: {
            learningPath: {
              select: {
                domain: { select: { name: true, slug: true } },
                targetAudiences: {
                  select: { targetAudience: { select: { grade: true } } },
                },
              },
            },
          },
        },
        figures: {
          where: { deletedAt: null, role: "SOLUTION" },
          take: 1,
          select: {
            currentRevision: {
              select: { sourceKind: true, latexSource: true, status: true },
            },
          },
        },
      },
    });
    if (!card) {
      throw notFoundException("FLASHCARD_NOT_FOUND", "Không tìm thấy Flashcard.");
    }
    const front = getTiptapText(card.frontJson);
    const solution = getTiptapText(card.solutionJson);
    if (!front || !solution) {
      throw badRequestException(
        "FLASHCARD_FIGURE_CONTEXT_EMPTY",
        "Flashcard phải có câu hỏi và lời giải chi tiết trước khi tạo hình.",
      );
    }
    const currentRevision = card.figures[0]?.currentRevision;
    const currentSolutionLatexSource =
      currentRevision?.sourceKind === "AI_TEX" &&
      currentRevision.status === "SUCCEEDED" &&
      currentRevision.latexSource?.trim()
        ? currentRevision.latexSource.trim()
        : null;
    if (mode === "EDIT_CURRENT" && !currentSolutionLatexSource) {
      throw badRequestException(
        "FLASHCARD_SOLUTION_FIGURE_NOT_EDITABLE",
        "Hình lời giải hiện tại không có source TeX hợp lệ để chỉnh sửa.",
      );
    }
    const metadata = asRecord(card.sourceMetadataJson);
    return {
      aiGenerationId: readFlashcardGenerationReference(card.sourceMetadataJson),
      context: {
        flashcardId: card.id,
        front,
        solution,
        currentSolutionLatexSource,
        sourcePacketPageNumbers: readPositiveIntegerArray(
          metadata.sourcePacketPageNumbers,
        ),
        targetGrade:
          card.lesson.learningPath.targetAudiences
            .map(({ targetAudience }) => targetAudience.grade)
            .filter((grade): grade is number => grade !== null)
            .sort((left, right) => left - right)[0] ?? null,
        subject: resolveFlashcardSubject({
          domainName: card.lesson.learningPath.domain.name,
          domainSlug: card.lesson.learningPath.domain.slug,
        }),
      },
    };
  }

  private async resolveRoute(dto: PreviewFlashcardFigureAiDto): Promise<AiFeatureRoute> {
    const base = await this.modelRouting.resolve(
      AiGenerationType.FLASHCARD,
      AiModelPurpose.IMAGE,
    );
    let candidates = base.candidates;
    if (dto.model) {
      const selected =
        candidates.find((candidate) => candidate.model === dto.model) ??
        (await this.modelRouting.resolveCandidateByModel(dto.model));
      if (!selected?.available) {
        throw badRequestException(
          "AI_MODEL_NOT_AVAILABLE",
          "Model đã chọn không còn khả dụng cho tạo hình Flashcard.",
        );
      }
      candidates = [selected];
    }
    const selected = candidates.find((candidate) => candidate.available);
    if (!selected) {
      throw badRequestException(
        "AI_PROVIDER_UNAVAILABLE",
        "Chưa có model khả dụng cho tạo hình Flashcard.",
      );
    }
    return {
      ...base,
      model: selected.model,
      candidates,
      temperature: dto.temperature ?? base.temperature,
      reasoningEffort: dto.reasoningEffort ?? base.reasoningEffort,
      maxOutputTokens: base.maxOutputTokens,
    };
  }

  private async toPreview(
    dto: PreviewFlashcardFigureAiDto,
    context: FlashcardFigureContext,
    request: AiStructuredInput,
    trace: ResolvedAiStructuredRequestPreview,
    routeSnapshot: AiFeatureRoute,
  ) {
    const resolvedRequest = {
      ...request,
      model: trace.model,
      temperature: trace.temperature ?? undefined,
      reasoningEffort: trace.reasoningEffort ?? undefined,
      maxTokens: trace.maxOutputTokens ?? undefined,
      systemPrompt: trace.systemPrompt,
      userPrompt: trace.userPrompt,
    };
    const modelOptions = await this.modelRouting.getAllActiveModels();
    return {
      requestHash: hashAiValue({
        flashcardId: context.flashcardId,
        role: "SOLUTION",
        mode: dto.mode ?? "REGENERATE",
        sourcePacketPageNumbers: context.sourcePacketPageNumbers,
        systemPrompt: trace.systemPrompt,
        userPrompt: trace.userPrompt,
        model: trace.model,
        temperature: trace.temperature,
        reasoningEffort: trace.reasoningEffort,
        schemaVersion: request.schemaVersion,
      }),
      role: "SOLUTION",
      mode: dto.mode ?? "REGENERATE",
      adminInstructions: dto.adminInstructions?.trim() || null,
      providerInput: buildOpenAiStructuredResponseRequest({
        request: resolvedRequest,
        model: trace.model,
        structuredTextFormat: trace.textFormat,
      }),
      configuration: {
        isDefaultConfigured: routeSnapshot.hasConfiguration,
        resolvedProvider: trace.provider,
        resolvedModel: trace.model,
        temperature: trace.temperature,
        reasoningEffort: trace.reasoningEffort,
        maxOutputTokens: trace.maxOutputTokens,
        modelOptions: modelOptions.map((option) => ({
          provider: option.provider,
          model: option.model,
          available: option.available,
          capabilities: option.capabilitiesJson,
        })),
      },
      systemPrompt: trace.systemPrompt,
      userPrompt: trace.userPrompt,
      context: trace.inputTokenEstimate,
      estimatedCost: trace.estimatedCost,
    };
  }
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readPositiveIntegerArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is number => Number.isInteger(item) && Number(item) > 0)
    : [];
}
