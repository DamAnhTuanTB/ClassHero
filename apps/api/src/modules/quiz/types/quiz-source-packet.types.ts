export type QuizSourcePacketPage = {
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

export type QuizSourcePacketManifest = {
  version: 1;
  lessonId: string;
  packetHash: string;
  pageCount: number;
  pages: QuizSourcePacketPage[];
};

export type QuizSourcePacketModelManifest = {
  version: 1;
  pages: Array<
    Pick<
      QuizSourcePacketPage,
      | "packetPageNumber"
      | "sourceKey"
      | "documentTitle"
      | "sourcePdfPageNumber"
      | "printedPageLabel"
    >
  >;
};

export type QuizSourcePacket = {
  filename: string;
  objectKey: string;
  bytes: Buffer;
  packetHash: string;
  manifestHash: string;
  manifest: QuizSourcePacketManifest;
  modelManifest: QuizSourcePacketModelManifest;
  sourceSnapshot: Record<string, unknown>;
  sourceHash: string;
};
