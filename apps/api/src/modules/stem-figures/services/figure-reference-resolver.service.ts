import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { PDFParse } from "pdf-parse";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import type { LessonSourcePacketManifest } from "#api/modules/ai/types/lesson-source-packet.types";
import type {
  StemFigureRenderPlan,
  StemFigureSourceTarget,
} from "#api/modules/ai/types/lesson-summary.types";
import {
  extractFigureIdentities,
  extractFigureIdentity,
  normalizeFigureLabelText,
} from "#api/modules/stem-figures/utils/figure-label-identity";

export type FigureReferenceAsset = {
  objectKey: string;
  mimeType: string;
  label: string;
  packetPageNumber: number;
  source: "OCR_CROP" | "PDF_PAGE";
  sourceTarget?: StemFigureSourceTarget | null;
};

export type FigureReferenceSnapshot = {
  version: 1;
  localPlanId: string;
  status: "resolved" | "ambiguous" | "page_fallback" | "not_found";
  assets: FigureReferenceAsset[];
  references: Array<{
    planReference: StemFigureRenderPlan["sourceReferences"][number];
    requestedPlanReference?: StemFigureRenderPlan["sourceReferences"][number];
    sourcePdfPageNumber: number | null;
    sourceDocumentId: string | null;
    lessonDocumentId: string | null;
    candidateImageIds: string[];
    warnings: string[];
  }>;
};

export type ReconciledFigureReference<TPlan extends StemFigureRenderPlan> = {
  plan: TPlan;
  snapshot: FigureReferenceSnapshot;
};

@Injectable()
export class FigureReferenceResolverService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
  ) {}

  async resolve(input: {
    manifest: LessonSourcePacketManifest;
    plan: StemFigureRenderPlan;
  }): Promise<FigureReferenceSnapshot> {
    const [result] = await this.resolveMany({
      manifest: input.manifest,
      plans: [input.plan],
    });
    if (!result) {
      throw new Error("Figure reference resolution returned no result.");
    }
    return result.snapshot;
  }

  async resolveMany<TPlan extends StemFigureRenderPlan>(input: {
    manifest: LessonSourcePacketManifest;
    plans: TPlan[];
  }): Promise<Array<ReconciledFigureReference<TPlan>>> {
    if (input.plans.length === 0) return [];

    const hasTextbookReferences = input.plans.some(
      (plan) => plan.figureOrigin === "TEXTBOOK_SOURCE",
    );
    if (!hasTextbookReferences) {
      return input.plans.map((plan) => ({
        plan,
        snapshot: emptyReferenceSnapshot(plan.localId),
      }));
    }

    const lessonDocumentIds = [
      ...new Set(input.manifest.pages.map((page) => page.lessonDocumentId)),
    ];
    const documents = await this.prisma.lessonDocument.findMany({
      where: { id: { in: lessonDocumentIds } },
      select: {
        id: true,
        file: { select: { id: true, objectKey: true, checksum: true } },
        activeOcrArtifact: {
          select: { id: true, imageManifestObjectKey: true },
        },
        sourceDocument: {
          select: {
            activeOcrArtifact: {
              select: { id: true, imageManifestObjectKey: true },
            },
          },
        },
      },
    });
    const documentsById = new Map(documents.map((document) => [document.id, document]));
    const imageManifestCache = new Map<string, Promise<OcrImageManifestShape>>();
    const imagesByDocumentId = new Map<string, OcrImageShape[]>();
    await Promise.all(
      documents.map(async (document) => {
        const artifact =
          document.activeOcrArtifact ??
          document.sourceDocument?.activeOcrArtifact ??
          null;
        if (!artifact?.imageManifestObjectKey) {
          imagesByDocumentId.set(document.id, []);
          return;
        }
        const manifestPromise =
          imageManifestCache.get(artifact.imageManifestObjectKey) ??
          this.loadImageManifest(artifact.imageManifestObjectKey);
        imageManifestCache.set(artifact.imageManifestObjectKey, manifestPromise);
        imagesByDocumentId.set(document.id, (await manifestPromise).images);
      }),
    );

    type DocumentRecord = (typeof documents)[number];
    type PacketPageContext = {
      page: LessonSourcePacketManifest["pages"][number];
      document: DocumentRecord | null;
      images: OcrImageShape[];
    };
    type PacketExactLocation = {
      context: PacketPageContext;
      evidence: OcrImageShape[];
    };

    const pageContexts = input.manifest.pages.map(
      (page): PacketPageContext => ({
        page,
        document: documentsById.get(page.lessonDocumentId) ?? null,
        images: imagesByDocumentId.get(page.lessonDocumentId) ?? [],
      }),
    );
    const pageContextsByPacketNumber = new Map(
      pageContexts.map((context) => [context.page.packetPageNumber, context] as const),
    );
    const exactLocationsByIdentity = new Map<
      string,
      Map<number, PacketExactLocation>
    >();
    for (const context of pageContexts) {
      for (const image of context.images) {
        if (image.pageNumber !== context.page.sourcePdfPageNumber) continue;
        for (const identity of extractFigureIdentities(image.captionCandidate ?? "")) {
          const locations =
            exactLocationsByIdentity.get(identity) ??
            new Map<number, PacketExactLocation>();
          const location = locations.get(context.page.packetPageNumber) ?? {
            context,
            evidence: [],
          };
          location.evidence.push(image);
          locations.set(context.page.packetPageNumber, location);
          exactLocationsByIdentity.set(identity, locations);
        }
      }
    }

    const pdfCache = new Map<string, Promise<Buffer>>();
    const results: Array<ReconciledFigureReference<TPlan>> = [];

    for (const plan of input.plans) {
      if (plan.figureOrigin === "GENERATED_FROM_BRIEF") {
        results.push({ plan, snapshot: emptyReferenceSnapshot(plan.localId) });
        continue;
      }

      const assets: FigureReferenceAsset[] = [];
      const references: FigureReferenceSnapshot["references"] = [];
      const effectiveReferences: typeof plan.sourceReferences = [];
      let sawAmbiguous = false;
      let sawFallback = false;

      for (const reference of plan.sourceReferences) {
        const requestedContext = pageContextsByPacketNumber.get(
          reference.packetPageNumber,
        );
        const requestedIdentity = extractFigureIdentity(reference.figureLabel ?? "");
        const exactLocations = requestedIdentity
          ? [...(exactLocationsByIdentity.get(requestedIdentity)?.values() ?? [])]
          : [];
        const requestedExactLocation = exactLocations.find(
          (location) =>
            location.context.page.packetPageNumber === reference.packetPageNumber,
        );
        const warnings: string[] = [];
        let effectiveContext = requestedContext;
        let globalMatchAmbiguous = false;

        if (!requestedExactLocation && exactLocations.length === 1) {
          effectiveContext = exactLocations[0]!.context;
          warnings.push("figure_label_exact_match_relocated");
        } else if (!requestedExactLocation && exactLocations.length > 1) {
          globalMatchAmbiguous = true;
          sawAmbiguous = true;
          warnings.push("figure_label_exact_match_multiple_pages");
        }

        const effectiveReference: typeof reference =
          effectiveContext && !globalMatchAmbiguous
            ? {
                ...reference,
                packetPageNumber: effectiveContext.page.packetPageNumber,
                printedPageLabel:
                  effectiveContext.page.printedPageLabel ??
                  reference.printedPageLabel,
              }
            : reference;
        if (
          effectiveContext &&
          !globalMatchAmbiguous &&
          effectiveContext.page.printedPageLabel === null &&
          reference.printedPageLabel !== null
        ) {
          warnings.push("printed_page_label_manifest_missing");
        } else if (
          effectiveContext &&
          !globalMatchAmbiguous &&
          effectiveContext.page.printedPageLabel !== null &&
          effectiveContext.page.printedPageLabel !== reference.printedPageLabel
        ) {
          warnings.push("printed_page_label_canonicalized");
        }
        effectiveReferences.push(effectiveReference);

        const page = effectiveContext?.page;
        const document = effectiveContext?.document;
        let selected: OcrImageShape[] = [];
        if (effectiveContext && page && document) {
          const selection = selectReferenceImages({
            images: effectiveContext.images,
            pageNumber: page.sourcePdfPageNumber,
            figureLabel: effectiveReference.figureLabel,
            query: [
              effectiveReference.figureLabel,
              effectiveReference.sourceTarget.locator,
            ]
              .filter(Boolean)
              .join(" "),
          });
          selected = selection.images;
          warnings.push(...selection.warnings);
          if (selection.ambiguous) sawAmbiguous = true;
        }

        if (page && document && selected.length === 0) {
          warnings.push("no_usable_ocr_crop");
          if (!canUsePageFallback(effectiveReference)) {
            warnings.push("ambiguous_page_fallback_target");
            sawAmbiguous = true;
            references.push({
              planReference: effectiveReference,
              ...(hasReferenceLocationChanged(reference, effectiveReference)
                ? { requestedPlanReference: reference }
                : {}),
              sourcePdfPageNumber: page.sourcePdfPageNumber,
              sourceDocumentId: page.sourceDocumentId,
              lessonDocumentId: page.lessonDocumentId,
              candidateImageIds: [],
              warnings: [...new Set(warnings)],
            });
            continue;
          }
          const fallback = await this.ensurePageFallback({
            file: document.file,
            pageNumber: page.sourcePdfPageNumber,
            pdfCache,
          });
          if (fallback) {
            sawFallback = true;
            assets.push({
              ...fallback,
              label:
                effectiveReference.figureLabel ??
                `Trang ${effectiveReference.packetPageNumber}`,
              packetPageNumber: effectiveReference.packetPageNumber,
              source: "PDF_PAGE",
              sourceTarget: effectiveReference.sourceTarget,
            });
          } else {
            warnings.push("page_render_failed");
          }
        } else {
          for (const candidate of selected) {
            assets.push({
              // Mathpix already extracted the labeled artwork. Preserve that
              // immutable crop instead of rebuilding a much larger region from
              // the PDF page and diluting the visual reference with prose,
              // captions, or page furniture.
              objectKey: candidate.objectKey,
              mimeType: candidate.mimeType,
              label:
                effectiveReference.figureLabel ??
                candidate.captionCandidate ??
                `Trang ${effectiveReference.packetPageNumber}`,
              packetPageNumber: effectiveReference.packetPageNumber,
              source: "OCR_CROP",
              sourceTarget: effectiveReference.sourceTarget,
            });
          }
        }
        references.push({
          planReference: effectiveReference,
          ...(hasReferenceLocationChanged(reference, effectiveReference)
            ? { requestedPlanReference: reference }
            : {}),
          sourcePdfPageNumber: page?.sourcePdfPageNumber ?? null,
          sourceDocumentId: page?.sourceDocumentId ?? null,
          lessonDocumentId: page?.lessonDocumentId ?? null,
          candidateImageIds: selected.map((candidate) => candidate.imageId),
          warnings: [...new Set(warnings)],
        });
      }

      const effectivePlan = {
        ...plan,
        sourceReferences: effectiveReferences,
      } as TPlan;
      results.push({
        plan: effectivePlan,
        snapshot: {
          version: 1,
          localPlanId: plan.localId,
          status: sawAmbiguous
            ? "ambiguous"
            : assets.length === 0
              ? "not_found"
              : sawFallback
                ? "page_fallback"
                : "resolved",
          assets: deduplicateAssets(assets),
          references,
        },
      });
    }

    return results;
  }

  private async loadImageManifest(objectKey: string) {
    const bytes = await this.storage.downloadObject(objectKey);
    const value = JSON.parse(bytes.toString("utf8")) as unknown;
    if (!isRecord(value) || !Array.isArray(value.images)) {
      throw new Error("OCR image manifest is invalid.");
    }
    return {
      images: value.images.flatMap((image) => parseOcrImage(image)),
    };
  }

  private async ensurePageFallback(input: {
    file: { id: string; objectKey: string; checksum: string | null };
    pageNumber: number;
    pdfCache: Map<string, Promise<Buffer>>;
  }) {
    const namespace = input.file.checksum ?? input.file.id;
    const objectKey = `derived/lesson-summary-reference-pages/${namespace}/page-${input.pageNumber}.png`;
    if (!(await this.storage.headObject(objectKey))) {
      const pdfPromise =
        input.pdfCache.get(input.file.id) ??
        this.storage.downloadObject(input.file.objectKey);
      input.pdfCache.set(input.file.id, pdfPromise);
      const parser = new PDFParse({ data: cloneBytes(await pdfPromise) });
      try {
        const screenshot = await parser.getScreenshot({
          partial: [input.pageNumber],
          desiredWidth: 1_600,
          imageDataUrl: false,
          imageBuffer: true,
        });
        const page = screenshot.pages[0];
        if (!page) return null;
        const bytes = Buffer.from(page.data);
        await this.storage.uploadObject({
          objectKey,
          body: bytes,
          contentLength: bytes.length,
          contentType: "image/png",
        });
      } finally {
        await parser.destroy();
      }
    }
    return { objectKey, mimeType: "image/png" };
  }
}

type OcrImageManifestShape = { images: OcrImageShape[] };
export type OcrImageShape = {
  imageId: string;
  pageNumber: number;
  objectKey: string;
  mimeType: string;
  captionCandidate: string | null;
  nearbyText: string | null;
  normalizedBoundingBox: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
  isUsableForAi: boolean;
  score: number;
};

function parseOcrImage(value: unknown): OcrImageShape[] {
  if (!isRecord(value)) return [];
  if (
    typeof value.imageId !== "string" ||
    typeof value.pageNumber !== "number" ||
    typeof value.objectKey !== "string" ||
    typeof value.mimeType !== "string"
  ) {
    return [];
  }
  return [
    {
      imageId: value.imageId,
      pageNumber: value.pageNumber,
      objectKey: value.objectKey,
      mimeType: value.mimeType,
      captionCandidate:
        typeof value.captionCandidate === "string" ? value.captionCandidate : null,
      nearbyText: typeof value.nearbyText === "string" ? value.nearbyText : null,
      normalizedBoundingBox: parseNormalizedBoundingBox(value.normalizedBoundingBox),
      isUsableForAi: value.isUsableForAi === true,
      score: 0,
    },
  ];
}

function parseNormalizedBoundingBox(value: unknown) {
  if (!isRecord(value)) return null;
  const coordinates = [value.x, value.y, value.w, value.h];
  if (!coordinates.every((coordinate) => typeof coordinate === "number")) {
    return null;
  }
  const [x, y, w, h] = coordinates as [number, number, number, number];
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

export function selectReferenceImages(input: {
  images: OcrImageShape[];
  pageNumber: number;
  figureLabel: string | null | undefined;
  query: string;
}) {
  const pageImages = input.images.filter(
    (image) => image.pageNumber === input.pageNumber,
  );
  const requestedIdentity = extractFigureIdentity(input.figureLabel ?? "");

  if (requestedIdentity) {
    const exactMatches = pageImages.filter((image) =>
      extractFigureIdentities(image.captionCandidate ?? "").includes(requestedIdentity),
    );
    if (exactMatches.length > 0) {
      const usableExactMatches = exactMatches.filter((image) => image.isUsableForAi);
      if (usableExactMatches.length === 0) {
        return {
          images: [],
          ambiguous: false,
          warnings: ["figure_label_exact_match_unusable"],
        };
      }
      const rankedExactMatches = rankImages({
        images: usableExactMatches,
        pageNumber: input.pageNumber,
        query: input.query,
      });
      return {
        // One textbook figure label may legitimately be split into multiple
        // complementary OCR crops (for example a construction panel and the
        // resulting solid). Preserve those distinct source panels; object-key
        // deduplication later still removes true duplicates.
        images: rankedExactMatches.slice(0, 4),
        ambiguous: false,
        warnings:
          rankedExactMatches.length > 1
            ? ["figure_label_exact_match_multiple_crops"]
            : [],
      };
    }

    // A formal source identifier is stronger evidence than nearby OCR text. If
    // no caption proves that a crop belongs to the requested figure, returning
    // no crop deliberately triggers the full-page fallback below. This prevents
    // a semantically similar neighbouring figure (for example Hình 5.25) from
    // being sent as the reference for Hình 5.26.
    return {
      images: [],
      ambiguous: false,
      warnings: ["figure_label_not_matched_using_page_fallback"],
    };
  }

  const usablePageImages = pageImages.filter((image) => image.isUsableForAi);
  const normalizedLabel = normalizeFigureLabelText(input.figureLabel ?? "").trim();
  if (!normalizedLabel) {
    return {
      images: [],
      ambiguous: false,
      warnings: ["figure_label_missing_using_page_fallback"],
    };
  }

  if (normalizedLabel) {
    const captionMatches = usablePageImages.filter((image) => {
      const caption = normalizeFigureLabelText(image.captionCandidate ?? "").trim();
      return (
        Boolean(caption) &&
        (caption === normalizedLabel ||
          caption.includes(normalizedLabel) ||
          normalizedLabel.includes(caption))
      );
    });
    if (captionMatches.length > 0) {
      const rankedCaptionMatches = rankImages({
        images: captionMatches,
        pageNumber: input.pageNumber,
        query: input.query,
      });
      return {
        images: rankedCaptionMatches.slice(0, 4),
        ambiguous: rankedCaptionMatches.length > 1,
        warnings:
          rankedCaptionMatches.length > 1
            ? ["figure_label_text_match_multiple_crops"]
            : [],
      };
    }
  }

  const ranked = rankImages({ ...input, images: usablePageImages });
  const ambiguous = ranked.length > 1 && ranked[0]!.score < ranked[1]!.score + 8;
  return {
    images: ranked.slice(0, 1),
    ambiguous,
    warnings: ambiguous ? ["multiple_visual_candidates"] : [],
  };
}

function canUsePageFallback(
  reference: StemFigureRenderPlan["sourceReferences"][number],
) {
  if (reference.sourceTarget.scope === "SUBFIGURE") {
    return Boolean(reference.sourceTarget.locator?.trim());
  }
  return Boolean(reference.figureLabel?.trim());
}

function rankImages(input: {
  images: OcrImageShape[];
  pageNumber: number;
  query: string;
}) {
  const terms = normalizeFigureLabelText(input.query)
    .split(/[^a-z0-9]+/u)
    .filter((term) => term.length > 1);
  return input.images
    .filter((image) => image.pageNumber === input.pageNumber)
    .map((image) => {
      const haystack = normalizeFigureLabelText(
        `${image.captionCandidate ?? ""} ${image.nearbyText ?? ""}`,
      );
      return {
        ...image,
        score:
          (image.isUsableForAi ? 50 : -20) +
          terms.filter((term) => haystack.includes(term)).length * 12 +
          (image.captionCandidate ? 6 : 0),
      };
    })
    .filter((image) => image.isUsableForAi)
    .sort((left, right) => right.score - left.score);
}

function deduplicateAssets(assets: FigureReferenceAsset[]) {
  return [...new Map(assets.map((asset) => [asset.objectKey, asset])).values()];
}

function emptyReferenceSnapshot(localPlanId: string): FigureReferenceSnapshot {
  return {
    version: 1,
    localPlanId,
    status: "not_found",
    assets: [],
    references: [],
  };
}

function hasReferenceLocationChanged(
  requested: StemFigureRenderPlan["sourceReferences"][number],
  effective: StemFigureRenderPlan["sourceReferences"][number],
) {
  return (
    requested.packetPageNumber !== effective.packetPageNumber ||
    requested.printedPageLabel !== effective.printedPageLabel
  );
}

function cloneBytes(value: Buffer) {
  const clone = new Uint8Array(value.length);
  clone.set(value);
  return clone;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function hashFigureReferenceSnapshot(value: FigureReferenceSnapshot) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
