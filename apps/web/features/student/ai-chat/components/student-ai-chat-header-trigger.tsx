"use client";

import Link from "next/link";
import { ImmediateTooltip } from "@/components/common/ui/immediate-tooltip";
import { MessengerIcon } from "@/components/student/courses/messenger-icon";
import { useAiChatAvailability } from "@/features/student/ai-chat/hooks/use-ai-chat-availability";
import {
  buildAiChatHref,
  type AiChatEntryContext,
} from "@/features/student/ai-chat/utils/ai-chat-link";
import { cn } from "@/lib/utils";

const BLOCKED_DURING_TEST_COPY =
  "Bạn không thể sử dụng tính năng này khi đang làm bài thi!";

export function StudentAiChatHeaderTrigger({
  context,
  className,
  testId,
}: {
  context: AiChatEntryContext;
  className?: string;
  testId?: string;
}) {
  const { isBlockedDuringTest } = useAiChatAvailability();
  const triggerClassName = cn(
    "ml-auto grid h-11 w-11 place-items-center rounded-full text-blue-600 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:text-sky-300",
    isBlockedDuringTest
      ? "cursor-not-allowed opacity-45"
      : "hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800",
    className,
  );
  const icon = (
    <span className="relative">
      <MessengerIcon className="h-7 w-7" strokeWidth={1.9} aria-hidden="true" />
      <span className="absolute -right-2 -top-2 rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-black leading-none text-white ring-2 ring-white dark:ring-[var(--theme-surface)]">
        AI
      </span>
    </span>
  );

  if (isBlockedDuringTest) {
    return (
      <ImmediateTooltip content={BLOCKED_DURING_TEST_COPY}>
        <button
          type="button"
          aria-disabled="true"
          aria-label="Chat với AI"
          data-testid={testId}
          className={triggerClassName}
        >
          {icon}
        </button>
      </ImmediateTooltip>
    );
  }

  return (
    <Link
      href={buildAiChatHref(context)}
      aria-label="Chat với AI"
      data-testid={testId}
      className={triggerClassName}
    >
      {icon}
    </Link>
  );
}
