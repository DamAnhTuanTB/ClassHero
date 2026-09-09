import type {
  AdminFlashcardRecord,
  AdminFlashcardSetRecord,
  StudentFlashcardSetRecord,
} from "#api/modules/flashcards/selectors/flashcard.selects";
import type { FilesService } from "#api/modules/files/services/files.service";

export function serializeAdminFlashcardSet(record: AdminFlashcardSetRecord) {
  const { _count, ...set } = record;
  return {
    ...set,
    cardCount: _count.flashcards,
  };
}

export function serializeAdminFlashcard(record: AdminFlashcardRecord) {
  return record;
}

export async function serializeAdminFlashcardAccessUrls(
  record: AdminFlashcardRecord,
  files: Pick<FilesService, "resolveAccessUrl">,
) {
  return {
    ...record,
    figures: await Promise.all(
      record.figures.map((figure) => serializeFlashcardFigureAccessUrl(figure, files)),
    ),
  };
}

export async function serializeStudentFlashcardSet(
  record: StudentFlashcardSetRecord,
  progressByCardId: Map<
    string,
    { isKnown: boolean; lastReviewedAt: Date; reviewCount: number }
  > = new Map(),
  favoriteCardIds: Set<string> = new Set(),
  files?: Pick<FilesService, "resolveAccessUrl">,
) {
  const progress = record.flashcards.map((flashcard) =>
    progressByCardId.get(flashcard.id),
  );
  const reviewedCount = progress.filter(Boolean).length;
  const knownCount = progress.filter((entry) => entry?.isKnown === true).length;
  return {
    ...record,
    cardCount: record.flashcards.length,
    flashcards: await Promise.all(
      record.flashcards.map(async ({ figures, ...flashcard }) => {
        const accessibleFigures = files
          ? await Promise.all(
              figures.map((figure) =>
                serializeFlashcardFigureAccessUrl(figure, files),
              ),
            )
          : figures;

        return {
          ...flashcard,
          solutionFigure: serializeStudentFlashcardSolutionFigure(
            accessibleFigures[0],
          ),
          progress: progressByCardId.get(flashcard.id) ?? null,
          isFavorite: favoriteCardIds.has(flashcard.id),
        };
      }),
    ),
    progress: {
      totalCount: record.flashcards.length,
      reviewedCount,
      knownCount,
      unknownCount: reviewedCount - knownCount,
      unreviewedCount: record.flashcards.length - reviewedCount,
      isCompleted:
        record.flashcards.length === 0 || reviewedCount === record.flashcards.length,
    },
  };
}

function serializeStudentFlashcardSolutionFigure<
  T extends {
    currentRevision: {
      altText: string;
      caption: string | null;
      deliveryFile: {
        id: string;
        mimeType: string;
        publicUrl: string | null;
      } | null;
    } | null;
  },
>(figure: T | undefined) {
  const revision = figure?.currentRevision;
  const file = revision?.deliveryFile;
  if (!revision || !file) return null;

  return {
    role: "SOLUTION" as const,
    altText: revision.altText,
    caption: revision.caption,
    fileId: file.id,
    mimeType: file.mimeType,
    url: file.publicUrl,
  };
}

async function serializeFlashcardFigureAccessUrl<
  T extends {
    currentRevision: {
      deliveryFile: {
        id: string;
        objectKey: string;
        publicUrl: string | null;
        visibility: "PRIVATE" | "PUBLIC";
      } | null;
    } | null;
  },
>(figure: T, files: Pick<FilesService, "resolveAccessUrl">) {
  const revision = figure.currentRevision;
  const file = revision?.deliveryFile;
  if (!revision || !file) return figure;

  const publicUrl = await files.resolveAccessUrl(file);
  const { objectKey: _objectKey, visibility: _visibility, ...deliveryFile } = file;
  return {
    ...figure,
    currentRevision: {
      ...revision,
      deliveryFile: { ...deliveryFile, publicUrl },
    },
  };
}
