import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  lessonSummaryOutputSchema,
  lessonSummaryProviderTransportOutputSchema,
} from "#api/modules/ai/types/lesson-summary.types";
import { mapLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-mapper";
import { recoverLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-recovery";

const repositoryRoot = resolve(process.cwd(), "../..");
const fullChunks = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    content:
      "Bài 15. Ba trường hợp bằng nhau của tam giác vuông. Nếu hai cạnh góc vuông của tam giác vuông này lần lượt bằng hai cạnh góc vuông của tam giác vuông kia thì hai tam giác vuông đó bằng nhau. Nếu cạnh huyền và một cạnh góc vuông tương ứng bằng nhau thì hai tam giác vuông bằng nhau.",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    content:
      "Ví dụ. Cho tam giác ABC vuông tại B và tam giác ADC vuông tại D. Biết AB = AD và AC là cạnh huyền chung. Chứng minh tam giác ABC bằng tam giác ADC. Bài tập vận dụng. Hai thanh giằng tạo thành hai tam giác vuông có cạnh huyền và một cạnh góc vuông tương ứng bằng nhau. Chứng minh hai khung bằng nhau.",
  },
];
const artifactPaths = [
  "tmp/m9-2-schema-ref-live-comparison/live-bai-15-inline.json",
  "tmp/m9-2-schema-ref-live-comparison/live-bai-15-ref.json",
  "tmp/m9-2-schema-ref-live-comparison/run-2/live-bai-15-inline.json",
  "tmp/m9-2-schema-ref-live-comparison/run-2/live-bai-15-ref.json",
  "tmp/m9-2-schema-ref-live-comparison/run-3/live-bai-15-inline.json",
  "tmp/m9-2-schema-ref-live-comparison/run-3/live-bai-15-ref.json",
  ...["grade-3-addition-commutative", "grade-8-square-of-sum", "grade-7-triangle-angle-sum"].flatMap(
    (caseId) =>
      ["inline", "ref"].map(
        (strategy) =>
          `tmp/m9-2-schema-ref-small-live-comparison/${caseId}/${strategy}.json`,
      ),
  ),
];
const historicalArtifactsAvailable = artifactPaths.every((path) =>
  existsSync(resolve(repositoryRoot, path)),
);

describe.skipIf(!historicalArtifactsAvailable)(
  "M9.2 historical inline/ref-v1 artifacts",
  () => {
    it("still parses and maps every paid historical output byte-for-byte", () => {
      for (const artifactPath of artifactPaths) {
        const artifact = JSON.parse(
          readFileSync(resolve(repositoryRoot, artifactPath), "utf8"),
        ) as {
          caseId?: string;
          source?: {
            targetGrade?: number;
            chunk?: { id: string; content: string };
          };
          providerOutput: unknown;
          summary: unknown;
        };
        const providerOutput = lessonSummaryProviderTransportOutputSchema.parse(
          artifact.providerOutput,
        );
        const persistedSummary = lessonSummaryOutputSchema.parse(artifact.summary);
        const chunks = artifact.source?.chunk
          ? [artifact.source.chunk]
          : fullChunks;
        const recovery = recoverLessonSummaryProviderOutput({
          output: providerOutput,
          contextChunks: chunks,
        });
        const mappedSummary = mapLessonSummaryProviderOutput({
          lessonId: persistedSummary.lessonId,
          output: recovery.output,
          contextChunks: chunks,
          reviewIssuesByPath: recovery.reviewIssuesByPath,
          rootReviewIssues: recovery.rootReviewIssues,
          targetGrade: artifact.source?.targetGrade ?? 7,
        });

        expect(mappedSummary, artifactPath).toEqual(persistedSummary);
      }
    });
  },
);
