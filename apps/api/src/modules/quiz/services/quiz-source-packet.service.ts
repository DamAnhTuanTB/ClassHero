import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentStatus } from "@prisma/client";
import { PDFDocument } from "pdf-lib";

import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import type {
  QuizSourcePacket,
  QuizSourcePacketModelManifest,
  QuizSourcePacketPage,
} from "#api/modules/quiz/types/quiz-source-packet.types";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";

export type QuizSourcePacketErrorCode =
  | "LESSON_NOT_FOUND"
  | "AI_PDF_SOURCE_NOT_READY"
  | "AI_PDF_SOURCE_EMPTY"
  | "AI_PDF_PACKET_TOO_LARGE"
  | "AI_PDF_PACKET_TOO_MANY_PAGES";

export class QuizSourcePacketError extends Error {
  constructor(
    readonly code: QuizSourcePacketErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "QuizSourcePacketError";
  }
}

@Injectable()
export class QuizSourcePacketService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorageService)
    private readonly storage: ObjectStorageService,
    @Inject(ConfigService)
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async build(lessonId: string, documentIds: string[]): Promise<QuizSourcePacket> {
    const documents = await this.loadDocuments(lessonId, documentIds);
    const output = await PDFDocument.create();
    output.setTitle("Temporary Quiz source packet");
    output.setAuthor("learning-path-mvp");
    output.setCreator("quiz-source-packet-v1");
    output.setProducer("quiz-source-packet-v1");
    output.setCreationDate(new Date(0));
    output.setModificationDate(new Date(0));

    const sourceBuffers = new Map<string, Buffer>();
    const sourcePdfs = new Map<string, PDFDocument>();
    const pages: QuizSourcePacketPage[] = [];
    for (let segmentOrder = 0; segmentOrder < documents.length; segmentOrder += 1) {
      const document = documents[segmentOrder]!;
      let sourceBuffer = sourceBuffers.get(document.file.id);
      if (!sourceBuffer) {
        sourceBuffer = await this.storage.downloadObject(document.file.objectKey);
        sourceBuffers.set(document.file.id, sourceBuffer);
      }
      let sourcePdf = sourcePdfs.get(document.file.id);
      if (!sourcePdf) {
        try {
          sourcePdf = await PDFDocument.load(sourceBuffer, { updateMetadata: false });
        } catch (error) {
          throw new QuizSourcePacketError(
            "AI_PDF_SOURCE_NOT_READY",
            `Không thể đọc PDF ${document.file.originalName}.`,
            { documentId: document.id, reason: toErrorMessage(error) },
          );
        }
        sourcePdfs.set(document.file.id, sourcePdf);
      }
      const selectedPageNumbers = resolvePageNumbers(document, sourcePdf.getPageCount());
      const copiedPages = await output.copyPages(
        sourcePdf,
        selectedPageNumbers.map((pageNumber) => pageNumber - 1),
      );
      const sourceKey = `D${String(segmentOrder + 1).padStart(2, "0")}`;
      for (let index = 0; index < copiedPages.length; index += 1) {
        output.addPage(copiedPages[index]!);
        const sourcePdfPageNumber = selectedPageNumbers[index]!;
        pages.push({
          packetPageNumber: pages.length + 1,
          sourceKey,
          lessonDocumentId: document.id,
          sourceDocumentId: document.sourceDocumentId,
          sourceFileId: document.file.id,
          sourcePdfPageNumber,
          printedPageLabel:
            document.sourceDocument?.pages.find(
              (page) => page.pageNumber === sourcePdfPageNumber,
            )?.printedPageLabel ?? null,
          pageRangeId: document.pageRangeId,
          documentTitle: document.title?.trim() || document.file.originalName,
          segmentOrder,
        });
      }
    }
    if (pages.length === 0) {
      throw new QuizSourcePacketError(
        "AI_PDF_SOURCE_EMPTY",
        "Packet PDF Quiz phải có ít nhất một trang.",
      );
    }
    const maxPages = this.config.get("AI_QUIZ_PACKET_MAX_PAGES", { infer: true });
    if (pages.length > maxPages) {
      throw new QuizSourcePacketError(
        "AI_PDF_PACKET_TOO_MANY_PAGES",
        `Packet Quiz có ${pages.length} trang, vượt giới hạn ${maxPages} trang.`,
        { pageCount: pages.length, maxPages },
      );
    }

    const bytes = Buffer.from(
      await output.save({ useObjectStreams: false, addDefaultPage: false }),
    );
    const maxBytes =
      this.config.get("AI_QUIZ_PACKET_MAX_MB", { infer: true }) * 1024 * 1024;
    if (bytes.length > maxBytes) {
      throw new QuizSourcePacketError(
        "AI_PDF_PACKET_TOO_LARGE",
        "Packet PDF Quiz vượt giới hạn dung lượng; hãy thu hẹp nguồn đã chọn.",
        { sizeBytes: bytes.length, maxBytes },
      );
    }
    const packetHash = sha256(bytes);
    const manifest = {
      version: 1 as const,
      lessonId,
      packetHash,
      pageCount: pages.length,
      pages,
    };
    const modelManifest: QuizSourcePacketModelManifest = {
      version: 1,
      pages: pages.map((page) => ({
        packetPageNumber: page.packetPageNumber,
        sourceKey: page.sourceKey,
        documentTitle: page.documentTitle,
        sourcePdfPageNumber: page.sourcePdfPageNumber,
        printedPageLabel: page.printedPageLabel,
      })),
    };
    const manifestHash = hashAiValue(modelManifest);
    const filename = "quiz-source.pdf";
    const objectKey = `temporary/quiz-source-packets/${lessonId}/${randomUUID()}-${packetHash.slice(0, 16)}.pdf`;
    await this.storage.uploadBuffer(objectKey, bytes, "application/pdf");
    const sourceSnapshot = buildSourceSnapshot(lessonId, documents);
    return {
      filename,
      objectKey,
      bytes,
      packetHash,
      manifestHash,
      manifest,
      modelManifest,
      sourceSnapshot,
      sourceHash: hashAiValue(sourceSnapshot),
    };
  }

  async computeCurrentSourceHash(lessonId: string, documentIds: string[]) {
    const documents = await this.loadDocuments(lessonId, documentIds);
    return hashAiValue(buildSourceSnapshot(lessonId, documents));
  }

  cleanup(objectKey: string) {
    return this.storage.deleteObject(objectKey);
  }

  download(objectKey: string) {
    return this.storage.downloadObject(objectKey);
  }

  private async loadDocuments(lessonId: string, documentIds: string[]) {
    const uniqueDocumentIds = [...new Set(documentIds)];
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null, learningPath: { deletedAt: null } },
      select: { id: true },
    });
    if (!lesson) {
      throw new QuizSourcePacketError("LESSON_NOT_FOUND", "Không tìm thấy buổi học.");
    }
    const documents = await this.prisma.lessonDocument.findMany({
      where: {
        id: { in: uniqueDocumentIds },
        lessonId,
        status: DocumentStatus.READY,
        replacedAt: null,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        sourceDocumentId: true,
        pageRangeId: true,
        updatedAt: true,
        file: {
          select: {
            id: true,
            objectKey: true,
            originalName: true,
            mimeType: true,
            checksum: true,
            status: true,
          },
        },
        pageRange: {
          select: { id: true, pageStart: true, pageEnd: true, updatedAt: true },
        },
        sourceDocument: {
          select: {
            status: true,
            pages: {
              orderBy: { pageNumber: "asc" },
              select: { pageNumber: true, metadataJson: true },
            },
          },
        },
      },
    });
    if (uniqueDocumentIds.length === 0 || documents.length !== uniqueDocumentIds.length) {
      throw new QuizSourcePacketError(
        "AI_PDF_SOURCE_NOT_READY",
        "Mọi tài liệu Quiz phải thuộc bài học và ở trạng thái READY.",
        { lessonId, documentIds: uniqueDocumentIds },
      );
    }
    return documents.map((document) => {
      const hasSourceDocument = document.sourceDocumentId !== null;
      const hasPageRange = document.pageRange !== null;
      if (
        document.file.mimeType !== "application/pdf" ||
        document.file.status === "DELETED" ||
        !document.file.checksum ||
        hasSourceDocument !== hasPageRange ||
        (hasSourceDocument && document.sourceDocument?.status !== DocumentStatus.READY)
      ) {
        throw new QuizSourcePacketError(
          "AI_PDF_SOURCE_NOT_READY",
          `Tài liệu ${document.title ?? document.file.originalName} chưa đủ điều kiện tạo packet PDF Quiz.`,
          { documentId: document.id },
        );
      }
      return {
        ...document,
        sourceDocument: document.sourceDocument
          ? {
              ...document.sourceDocument,
              pages: document.sourceDocument.pages.map((page) => ({
                pageNumber: page.pageNumber,
                printedPageLabel: readPrintedPageLabel(page.metadataJson),
              })),
            }
          : null,
      };
    });
  }
}

function buildSourceSnapshot(
  lessonId: string,
  documents: Array<{
    id: string;
    updatedAt: Date;
    sourceDocumentId: string | null;
    file: { id: string; checksum: string | null };
    pageRange: {
      id: string;
      pageStart: number;
      pageEnd: number;
      updatedAt: Date;
    } | null;
  }>,
) {
  return {
    lessonId,
    documents: documents.map((document) => ({
      id: document.id,
      updatedAt: document.updatedAt.toISOString(),
      fileId: document.file.id,
      fileChecksum: document.file.checksum,
      sourceDocumentId: document.sourceDocumentId,
      pageRange: document.pageRange
        ? {
            id: document.pageRange.id,
            pageStart: document.pageRange.pageStart,
            pageEnd: document.pageRange.pageEnd,
            updatedAt: document.pageRange.updatedAt.toISOString(),
          }
        : null,
    })),
  };
}

function resolvePageNumbers(
  document: { pageRange: { pageStart: number; pageEnd: number } | null },
  pageCount: number,
) {
  if (!document.pageRange) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  if (
    document.pageRange.pageStart < 1 ||
    document.pageRange.pageEnd > pageCount ||
    document.pageRange.pageStart > document.pageRange.pageEnd
  ) {
    throw new QuizSourcePacketError(
      "AI_PDF_SOURCE_NOT_READY",
      "Khoảng trang không còn khớp PDF canonical.",
      { ...document.pageRange, pageCount },
    );
  }
  return Array.from(
    { length: document.pageRange.pageEnd - document.pageRange.pageStart + 1 },
    (_, index) => document.pageRange!.pageStart + index,
  );
}

function readPrintedPageLabel(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const printedPage = (value as Record<string, unknown>).printedPage;
  if (!printedPage || typeof printedPage !== "object" || Array.isArray(printedPage)) {
    return null;
  }
  const label = (printedPage as Record<string, unknown>).printedPageLabel;
  return typeof label === "string" && label.trim() ? label.trim() : null;
}

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
