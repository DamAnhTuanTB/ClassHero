import { AiChatResponsePolicy } from "@prisma/client";
import type { AiChatAnswerAccess } from "#api/modules/ai-chat/types/ai-chat.types";

export const AI_CHAT_ACTIVITY_KINDS = ["QUIZ", "FLASHCARD", "TEST"] as const;
export type AiChatActivityKind = (typeof AI_CHAT_ACTIVITY_KINDS)[number];

export const AI_CHAT_ACTIVITY_STATES = [
  "UNANSWERED",
  "ANSWER_REVEALED",
  "IN_PROGRESS",
  "SUBMITTED",
] as const;
export type AiChatActivityState = (typeof AI_CHAT_ACTIVITY_STATES)[number];

export type AiChatActivityPolicyDecision = {
  policy: AiChatResponsePolicy;
  answerAccess: AiChatAnswerAccess;
};

export function resolveAiChatActivityPolicy(input: {
  kind: AiChatActivityKind;
  state: AiChatActivityState;
}): AiChatActivityPolicyDecision | null {
  if (input.kind === "TEST") {
    if (input.state === "IN_PROGRESS") {
      return {
        policy: AiChatResponsePolicy.BLOCKED,
        answerAccess: "BLOCKED",
      };
    }
    return input.state === "SUBMITTED"
      ? {
          policy: AiChatResponsePolicy.FULL_ANSWER,
          answerAccess: "FULL_SCOPE",
        }
      : null;
  }

  if (input.state === "SUBMITTED") {
    return {
      policy: AiChatResponsePolicy.FULL_ANSWER,
      answerAccess: "FULL_SCOPE",
    };
  }

  if (input.state === "UNANSWERED") {
    return {
      policy: AiChatResponsePolicy.HINT_ONLY,
      answerAccess: "HINT_ONLY",
    };
  }
  return input.state === "ANSWER_REVEALED"
    ? {
        policy: AiChatResponsePolicy.FULL_ANSWER,
        answerAccess: "FULL_CURRENT_TARGET",
      }
    : null;
}
