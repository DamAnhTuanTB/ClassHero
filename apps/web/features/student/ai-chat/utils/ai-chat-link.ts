import type {
  AiChatActiveActivity,
  AiChatTarget,
} from "@/features/ai-chat/types/ai-chat-types";

export type AiChatEntryContext =
  | { scopeType: "LIBRARY"; preferredLessonIds?: string[] }
  | {
      scopeType: "COURSE";
      learningPathId: string;
      surfaceLessonId?: string;
      preferredLessonIds?: string[];
      videoPlaybackSeconds?: number;
      target?: AiChatTarget;
      activeActivity?: AiChatActiveActivity;
    };

export const AI_CHAT_ACTIVITY_QUERY_KEYS = [
  "activityType",
  "activityId",
  "targetType",
  "targetId",
] as const;

export function buildAiChatHref(context: AiChatEntryContext) {
  const query = new URLSearchParams({ scope: context.scopeType });
  if (context.scopeType === "COURSE") {
    query.set("learningPathId", context.learningPathId);
    if (context.surfaceLessonId) query.set("surfaceLessonId", context.surfaceLessonId);
    if (context.videoPlaybackSeconds !== undefined) {
      query.set("videoPlaybackSeconds", String(context.videoPlaybackSeconds));
    }
    if (context.activeActivity) {
      query.set("activityType", context.activeActivity.activityType);
      query.set("activityId", context.activeActivity.activityId);
    }
    const target = context.activeActivity ?? context.target;
    if (target) {
      query.set("targetType", target.targetType);
      query.set("targetId", target.targetId);
    }
  }
  for (const lessonId of new Set(context.preferredLessonIds ?? [])) {
    query.append("preferredLessonId", lessonId);
  }
  return `/student/ai-chat?${query.toString()}`;
}

export function readAiChatPreferredLessonIds(params: Pick<URLSearchParams, "getAll">) {
  return [...new Set(params.getAll("preferredLessonId").filter(Boolean))];
}

export function readAiChatActiveActivity(
  params: Pick<URLSearchParams, "get">,
): AiChatActiveActivity | undefined {
  const activityType = params.get("activityType");
  const activityId = params.get("activityId");
  const targetType = params.get("targetType");
  const targetId = params.get("targetId");
  if (!activityId || !targetId) return undefined;

  if (activityType === "QUIZ_ATTEMPT" && targetType === "QUIZ_QUESTION") {
    return { activityType, activityId, targetType, targetId };
  }
  if (activityType === "FLASHCARD_STUDY_SESSION" && targetType === "FLASHCARD") {
    return { activityType, activityId, targetType, targetId };
  }
  return undefined;
}

export function readAiChatTarget(
  params: Pick<URLSearchParams, "get">,
): AiChatTarget | undefined {
  const targetType = params.get("targetType");
  const targetId = params.get("targetId");
  if (!targetId) return undefined;
  if (
    targetType === "QUIZ_QUESTION" ||
    targetType === "FLASHCARD" ||
    targetType === "TEST_QUESTION"
  ) {
    return { targetType, targetId };
  }
  return undefined;
}

export function replaceAiChatActivityQuery(
  query: URLSearchParams,
  activity?: AiChatActiveActivity,
  target?: AiChatTarget,
) {
  for (const key of AI_CHAT_ACTIVITY_QUERY_KEYS) query.delete(key);
  if (activity) {
    query.set("activityType", activity.activityType);
    query.set("activityId", activity.activityId);
  }
  const nextTarget = activity ?? target;
  if (nextTarget) {
    query.set("targetType", nextTarget.targetType);
    query.set("targetId", nextTarget.targetId);
  }
}
