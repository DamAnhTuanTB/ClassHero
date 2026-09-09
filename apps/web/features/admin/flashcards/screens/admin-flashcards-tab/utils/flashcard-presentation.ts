import type {
  AdminFlashcard,
  FlashcardItemDifficulty,
} from "@/features/admin/flashcards/api/admin-flashcards-api";

export const flashcardDifficultyLabels: Record<FlashcardItemDifficulty, string> = {
  EASY: "Dễ",
  MEDIUM: "Trung bình",
  HARD: "Khó",
};

export function flashcardDifficultyBadgeClassName(
  difficulty: FlashcardItemDifficulty,
) {
  if (difficulty === "EASY") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800/80 dark:bg-cyan-950/40 dark:text-cyan-300";
  }
  if (difficulty === "MEDIUM") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/80 dark:bg-blue-950/40 dark:text-blue-300";
  }
  return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/80 dark:bg-rose-950/40 dark:text-rose-300";
}

export interface FlashcardContentImage {
  alt: string;
  cardId: string;
  cardNumber: number;
  side: "Mặt trước" | "Mặt sau" | "Lời giải";
  src: string;
}

export function collectFlashcardContentImages(cards: AdminFlashcard[]) {
  return cards.flatMap((card, index) => [
    ...(card.figures ?? []).flatMap((figure) => {
      const source = figure.currentRevision?.deliveryFile?.publicUrl;
      return source
        ? [{
            alt: figure.currentRevision?.altText ?? "",
            cardId: card.id,
            cardNumber: index + 1,
            side: "Lời giải" as const,
            src: source,
          }]
        : [];
    }),
    ...collectImagesFromNode(card.frontJson, card.id, index + 1, "Mặt trước"),
    ...collectImagesFromNode(card.backJson, card.id, index + 1, "Mặt sau"),
    ...collectImagesFromNode(
      card.solutionJson,
      card.id,
      index + 1,
      "Lời giải",
    ),
  ]);
}

function collectImagesFromNode(
  value: unknown,
  cardId: string,
  cardNumber: number,
  side: FlashcardContentImage["side"],
): FlashcardContentImage[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) =>
      collectImagesFromNode(item, cardId, cardNumber, side),
    );
  }
  const record = value as Record<string, unknown>;
  const current =
    record.type === "image" &&
    record.attrs &&
    typeof record.attrs === "object" &&
    typeof (record.attrs as Record<string, unknown>).src === "string"
      ? [
          {
            alt:
              typeof (record.attrs as Record<string, unknown>).alt === "string"
                ? String((record.attrs as Record<string, unknown>).alt)
                : "",
            cardId,
            cardNumber,
            side,
            src: String((record.attrs as Record<string, unknown>).src),
          },
        ]
      : [];
  return [
    ...current,
    ...(Array.isArray(record.content)
      ? record.content.flatMap((item) =>
          collectImagesFromNode(item, cardId, cardNumber, side),
        )
      : []),
  ];
}
