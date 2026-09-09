export type FlashcardSourcePacketPage = {
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

export type FlashcardSourcePacketManifest = {
  version: 1;
  lessonId: string;
  packetHash: string;
  pageCount: number;
  pages: FlashcardSourcePacketPage[];
};

export type FlashcardSourcePacketModelManifest = {
  version: 1;
  pages: Array<
    Pick<
      FlashcardSourcePacketPage,
      | "packetPageNumber"
      | "sourceKey"
      | "documentTitle"
      | "sourcePdfPageNumber"
      | "printedPageLabel"
    >
  >;
};

export type FlashcardSourcePacket = {
  filename: string;
  objectKey: string;
  bytes: Buffer;
  packetHash: string;
  manifestHash: string;
  manifest: FlashcardSourcePacketManifest;
  modelManifest: FlashcardSourcePacketModelManifest;
  sourceSnapshot: Record<string, unknown>;
  sourceHash: string;
};
