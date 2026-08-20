export type LessonSourcePacketPage = {
  packetPageNumber: number;
  sourceKey: string;
  lessonDocumentId: string;
  sourceDocumentId: string | null;
  sourceFileId: string;
  sourcePdfPageNumber: number;
  printedPageLabel: string | null;
  pageRangeId: string | null;
  documentTitle: string;
  segmentOrder: number;
};

export type LessonSourcePacketManifest = {
  version: 1;
  lessonId: string;
  packetHash: string;
  pageCount: number;
  pages: LessonSourcePacketPage[];
};

export type LessonSourcePacketModelManifest = {
  version: 1;
  pages: Array<
    Pick<
      LessonSourcePacketPage,
      | "packetPageNumber"
      | "sourceKey"
      | "documentTitle"
      | "sourcePdfPageNumber"
      | "printedPageLabel"
    >
  >;
};

export type LessonSourcePacket = {
  filename: string;
  objectKey: string;
  bytes: Buffer;
  packetHash: string;
  manifestHash: string;
  manifest: LessonSourcePacketManifest;
  modelManifest: LessonSourcePacketModelManifest;
  sourceSnapshot: Record<string, unknown>;
  sourceHash: string;
};
