import type { VideoSummaryRequest } from "@/features/admin/lessons/api/admin-video-summary-api";

export function prepareVideoSummaryPreviewRequest(
  request: VideoSummaryRequest,
  options: {
    preserveSystemPrompt: boolean;
    preserveUserPrompt: boolean;
  },
): VideoSummaryRequest {
  const current = { ...request };
  delete current.requestDraftId;
  delete current.requestHash;

  return {
    ...current,
    systemInstructions: options.preserveSystemPrompt
      ? current.systemInstructions
      : undefined,
    userPrompt: options.preserveUserPrompt ? current.userPrompt : undefined,
  };
}
