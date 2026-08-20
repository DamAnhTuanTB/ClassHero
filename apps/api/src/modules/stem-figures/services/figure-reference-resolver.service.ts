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
    sourcePdfPageNumber: number | null;
    sourceDocumentId: string | null;
    lessonDocumentId: string | null;
    candidateImageIds: string[];
    warnings: string[];
  }>;
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
    if (input.plan.figureOrigin === "GENERATED_FROM_BRIEF") {
      return {
        version: 1,
        localPlanId: input.plan.localId,
        status: "not_found",
        assets: [],
        references: [],
      };
    }

    const manifestPages = new Map(
      input.manifest.pages.map((page) => [page.packetPageNumber, page] as const),
    );
    const lessonDocumentIds = [
      ...new Set(
        input.plan.sourceReferences
          .map(
            (reference) =>
              manifestPages.get(reference.packetPageNumber)?.lessonDocumentId,
          )
          .filter((value): value is string => Boolean(value)),
      ),
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
    const pdfCache = new Map<string, Promise<Buffer>>();
    const assets: FigureReferenceAsset[] = [];
    const references: FigureReferenceSnapshot["references"] = [];
    let sawAmbiguous = false;
    let sawFallback = false;

    for (const reference of input.plan.sourceReferences) {
      const page = manifestPages.get(reference.packetPageNumber);
      const document = page ? documentsById.get(page.lessonDocumentId) : null;
      const warnings: string[] = [];
      const artifact =
        document?.activeOcrArtifact ??
        document?.sourceDocument?.activeOcrArtifact ??
        null;
      let selected: OcrImageShape[] = [];
      if (page && artifact?.imageManifestObjectKey) {
        const manifestPromise =
          imageManifestCache.get(artifact.imageManifestObjectKey) ??
          this.loadImageManifest(artifact.imageManifestObjectKey);
        imageManifestCache.set(artifact.imageManifestObjectKey, manifestPromise);
        const imageManifest = await manifestPromise;
        const selection = selectReferenceImages({
          images: imageManifest.images,
          pageNumber: page.sourcePdfPageNumber,
          figureLabel: reference.figureLabel,
          query: [
            reference.figureLabel,
            "sourceTarget" in reference ? reference.sourceTarget.locator : null,
          ]
            .filter(Boolean)
            .join(" "),
        });
        selected = selection.images;
        warnings.push(...selection.warnings);
        if (selection.ambiguous) {
          sawAmbiguous = true;
        }
      }

      if (page && document && selected.length === 0) {
        warnings.push("no_usable_ocr_crop");
        if (!canUsePageFallback(reference)) {
          warnings.push("ambiguous_page_fallback_target");
          sawAmbiguous = true;
          references.push({
            planReference: reference,
            sourcePdfPageNumber: page.sourcePdfPageNumber,
            sourceDocumentId: page.sourceDocumentId,
            lessonDocumentId: page.lessonDocumentId,
            candidateImageIds: [],
            warnings,
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
            label: reference.figureLabel ?? `Trang ${reference.packetPageNumber}`,
            packetPageNumber: reference.packetPageNumber,
            source: "PDF_PAGE",
            sourceTarget: "sourceTarget" in reference ? reference.sourceTarget : null,
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
              reference.figureLabel ??
              candidate.captionCandidate ??
              `Trang ${reference.packetPageNumber}`,
            packetPageNumber: reference.packetPageNumber,
            source: "OCR_CROP",
            sourceTarget: "sourceTarget" in reference ? reference.sourceTarget : null,
          });
        }
      }
      references.push({
        planReference: reference,
        sourcePdfPageNumber: page?.sourcePdfPageNumber ?? null,
        sourceDocumentId: page?.sourceDocumentId ?? null,
        lessonDocumentId: page?.lessonDocumentId ?? null,
        candidateImageIds: selected.map((candidate) => candidate.imageId),
        warnings,
      });
    }

    return {
      version: 1,
      localPlanId: input.plan.localId,
      status:
        assets.length === 0
          ? "not_found"
          : sawAmbiguous
            ? "ambiguous"
            : sawFallback
              ? "page_fallback"
              : "resolved",
      assets: deduplicateAssets(assets),
      references,
    };
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
    (image) => image.pageNumber === input.pageNumber && image.isUsableForAi,
  );
  const requestedIdentity = extractFigureIdentity(input.figureLabel ?? "");

  if (requestedIdentity) {
    const exactMatches = pageImages.filter((image) =>
      extractFigureIdentities(image.captionCandidate ?? "").includes(requestedIdentity),
    );
    if (exactMatches.length > 0) {
      const rankedExactMatches = rankImages({
        images: exactMatches,
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

  const normalizedLabel = normalize(input.figureLabel ?? "").trim();
  if (!normalizedLabel) {
    return {
      images: [],
      ambiguous: false,
      warnings: ["figure_label_missing_using_page_fallback"],
    };
  }

  if (normalizedLabel) {
    const captionMatches = pageImages.filter((image) => {
      const caption = normalize(image.captionCandidate ?? "").trim();
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

  const ranked = rankImages(input);
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
  const terms = normalize(input.query)
    .split(/[^a-z0-9]+/u)
    .filter((term) => term.length > 1);
  return input.images
    .filter((image) => image.pageNumber === input.pageNumber)
    .map((image) => {
      const haystack = normalize(
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

function extractFigureIdentity(value: string) {
  return extractFigureIdentities(value)[0] ?? null;
}

function extractFigureIdentities(value: string) {
  const normalized = normalize(value);
  const identities = new Set<string>();
  const pattern =
    /\b(?:hinh|figure|fig)\s*[:.#-]?\s*([0-9]+(?:\s*[.-]\s*[0-9]+)*(?:\s*[a-z])?)/gu;
  for (const match of normalized.matchAll(pattern)) {
    const identity = match[1]?.replace(/\s+/gu, "").replace(/-/gu, ".");
    if (identity) identities.add(identity);
  }
  return [...identities];
}

function deduplicateAssets(assets: FigureReferenceAsset[]) {
  return [...new Map(assets.map((asset) => [asset.objectKey, asset])).values()];
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/đ/gu, "d")
    .toLowerCase();
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
