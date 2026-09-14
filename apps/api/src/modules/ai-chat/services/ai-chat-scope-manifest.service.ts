import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { AiChatScopeAccess } from "#api/modules/ai-chat/types/ai-chat.types";

const MAX_SCOPE_MANIFEST_CHARACTERS = 4_800;

type ScopeManifestPath = {
  id: string;
  title: string;
  domain: { name: string };
  lessons: Array<{ id: string; title: string }>;
};

export type AiChatScopeManifest = {
  text: string;
  authorizedLearningPathCount: number;
  listedLearningPathCount: number;
  listedLessonCount: number;
  truncated: boolean;
};

@Injectable()
export class AiChatScopeManifestService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async build(
    scope: AiChatScopeAccess,
    surfaceLessonId?: string,
  ): Promise<AiChatScopeManifest> {
    const allowedLessonIds = scope.lessonIds?.length ? scope.lessonIds : null;
    const paths = await this.prisma.learningPath.findMany({
      where: { id: { in: scope.learningPathIds }, deletedAt: null },
      select: {
        id: true,
        title: true,
        domain: { select: { name: true } },
        lessons: {
          where: {
            deletedAt: null,
            ...(allowedLessonIds ? { id: { in: allowedLessonIds } } : {}),
          },
          orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
          select: { id: true, title: true },
        },
      },
    });

    const scopeOrder = new Map(
      scope.learningPathIds.map((learningPathId, index) => [learningPathId, index]),
    );
    const surfacePathId = surfaceLessonId
      ? paths.find((path) => path.lessons.some((lesson) => lesson.id === surfaceLessonId))
          ?.id
      : undefined;
    const orderedPaths = [...paths].sort((left, right) => {
      if (left.id === surfacePathId && right.id !== surfacePathId) return -1;
      if (right.id === surfacePathId && left.id !== surfacePathId) return 1;
      return (
        (scopeOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (scopeOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      );
    });

    return formatAuthorizedScopeManifest(orderedPaths);
  }
}

export function formatAuthorizedScopeManifest(
  paths: ScopeManifestPath[],
  maxCharacters = MAX_SCOPE_MANIFEST_CHARACTERS,
): AiChatScopeManifest {
  const lines: string[] = [];
  const listedPaths: Array<{ path: ScopeManifestPath; pathNumber: number }> = [];
  let listedLessonCount = 0;
  let truncated = false;

  for (const [pathIndex, path] of paths.entries()) {
    const header = `- Khóa ${pathIndex + 1}: ${compactManifestLabel(path.title)} | Môn: ${compactManifestLabel(path.domain.name)}`;
    if (!appendWithinLimit(lines, header, maxCharacters)) {
      truncated = true;
      break;
    }
    listedPaths.push({ path, pathNumber: pathIndex + 1 });
  }

  for (const { path, pathNumber } of listedPaths) {
    const lessonPrefix = `  Bài học khóa ${pathNumber}: `;
    let lessonLine = lessonPrefix;
    for (const lesson of path.lessons) {
      const title = compactManifestLabel(lesson.title);
      const separator = lessonLine === lessonPrefix ? "" : "; ";
      const nextLine = `${lessonLine}${separator}${title}`;
      if (serializedLength([...lines, nextLine]) > maxCharacters) {
        truncated = true;
        break;
      }
      lessonLine = nextLine;
      listedLessonCount += 1;
    }
    if (lessonLine !== lessonPrefix) lines.push(lessonLine);
    if (truncated) break;
  }

  if (truncated) {
    const suffix = "[Danh mục đã rút gọn để giảm độ trễ; đây không mở rộng phạm vi.]";
    if (serializedLength([...lines, suffix]) <= maxCharacters) lines.push(suffix);
  }

  return {
    text: lines.join("\n"),
    authorizedLearningPathCount: paths.length,
    listedLearningPathCount: listedPaths.length,
    listedLessonCount,
    truncated,
  };
}

function appendWithinLimit(lines: string[], value: string, maxCharacters: number) {
  if (serializedLength([...lines, value]) > maxCharacters) return false;
  lines.push(value);
  return true;
}

function serializedLength(lines: string[]) {
  return lines.join("\n").length;
}

function compactManifestLabel(value: string) {
  return value
    .replace(/[\r\n|]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}
