import { buildAiStructuredTextFormat } from "#api/modules/ai/utils/ai-structured-output-format";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import {
  buildVideoSummaryProviderOutputSchema,
  type VideoSummaryChapter,
} from "#api/modules/learning-paths/utils/video-summary-output";
import {
  buildVideoSummaryStructuredRequestPolicy,
  VIDEO_SUMMARY_PROMPT_VERSION,
} from "#api/modules/learning-paths/utils/video-summary-prompt";

export const VIDEO_SUMMARY_SCHEMA_NAME = "video_summary_output";
export const VIDEO_SUMMARY_SCHEMA_VERSION = "9";

export function buildVideoSummaryProviderContract(
  chapters: readonly VideoSummaryChapter[],
) {
  const outputSchema = buildVideoSummaryProviderOutputSchema(chapters);
  const format = buildAiStructuredTextFormat(
    outputSchema,
    VIDEO_SUMMARY_SCHEMA_NAME,
    buildVideoSummaryStructuredRequestPolicy().schemaReferenceStrategy,
  );

  return {
    outputSchema,
    schemaJson: format.schema,
    schemaName: VIDEO_SUMMARY_SCHEMA_NAME,
    schemaVersion: VIDEO_SUMMARY_SCHEMA_VERSION,
    schemaHash: hashAiValue(format.schema),
    promptVersion: VIDEO_SUMMARY_PROMPT_VERSION,
  } as const;
}
