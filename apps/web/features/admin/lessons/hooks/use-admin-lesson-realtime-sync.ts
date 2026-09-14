"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  backgroundJobStatusChangedEventSchema,
  lessonRealtimeSubscriptionAckSchema,
  realtimeSocketEvents,
  type BackgroundJobStatusChangedEvent,
} from "@learning-path/shared";

import { useAuthenticatedRealtime } from "@/components/common/realtime/authenticated-realtime-provider";
import { adminAiGenerationQueryKeys } from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import type { AdminAiJobData } from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { adminAssessmentQueryKeys } from "@/features/admin/assessments/hooks/use-admin-assessment";

export function useAdminLessonRealtimeSync(lessonId: string) {
  const { socket, status } = useAuthenticatedRealtime();
  const queryClient = useQueryClient();
  const handledEventIdsRef = useRef(new Set<string>());
  const resourceRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingResourceTypesRef = useRef(new Set<string | null>());

  useEffect(() => {
    if (!socket || status !== "connected" || !lessonId) return;

    const refreshSnapshot = () => {
      void queryClient.invalidateQueries({
        queryKey: adminAiGenerationQueryKeys.panel(lessonId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "ai-generations"],
      });
    };

    const subscribe = () => {
      socket.emit(
        realtimeSocketEvents.lessonSubscribe,
        { schemaVersion: 1, lessonId },
        (rawAck: unknown) => {
          const ack = lessonRealtimeSubscriptionAckSchema.safeParse(rawAck);
          if (ack.success && ack.data.ok) refreshSnapshot();
        },
      );
    };

    const handleJobStatus = (rawEvent: unknown) => {
      const parsed = backgroundJobStatusChangedEventSchema.safeParse(rawEvent);
      if (!parsed.success || parsed.data.lessonId !== lessonId) return;
      const event = parsed.data;
      if (handledEventIdsRef.current.has(event.eventId)) return;
      rememberEventId(handledEventIdsRef.current, event.eventId);

      queryClient.setQueryData<AdminAiJobData>(
        adminAiGenerationQueryKeys.job(event.jobId),
        (current) =>
          current
            ? {
                ...current,
                status: event.status,
                resourceType: event.resourceType,
                resourceId: event.resourceId,
                updatedAt: event.updatedAt,
              }
            : current,
      );
      void queryClient.invalidateQueries({
        queryKey: adminAiGenerationQueryKeys.job(event.jobId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "quiz", "solution-refinement-job", event.jobId],
      });
      void queryClient.invalidateQueries({
        queryKey: adminAiGenerationQueryKeys.panel(lessonId),
      });

      scheduleResourceRefresh(
        event.resourceType,
        lessonId,
        queryClient,
        resourceRefreshTimerRef,
        pendingResourceTypesRef,
      );
    };

    socket.on(realtimeSocketEvents.backgroundJobStatusChanged, handleJobStatus);
    subscribe();

    return () => {
      socket.off(realtimeSocketEvents.backgroundJobStatusChanged, handleJobStatus);
      socket.emit(realtimeSocketEvents.lessonUnsubscribe, {
        schemaVersion: 1,
        lessonId,
      });
      if (resourceRefreshTimerRef.current) {
        clearTimeout(resourceRefreshTimerRef.current);
        resourceRefreshTimerRef.current = null;
      }
      pendingResourceTypesRef.current.clear();
    };
  }, [lessonId, queryClient, socket, status]);
}

function scheduleResourceRefresh(
  resourceType: BackgroundJobStatusChangedEvent["resourceType"],
  lessonId: string,
  queryClient: ReturnType<typeof useQueryClient>,
  timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
  pendingResourceTypesRef: MutableRefObject<Set<string | null>>,
) {
  pendingResourceTypesRef.current.add(resourceType);
  if (timerRef.current) return;
  timerRef.current = setTimeout(() => {
    timerRef.current = null;
    const resourceTypes = [...pendingResourceTypesRef.current];
    pendingResourceTypesRef.current.clear();
    const refreshes: Promise<unknown>[] = [];
    for (const pendingResourceType of resourceTypes) {
      switch (pendingResourceType) {
        case "LESSON_SUMMARY":
          refreshes.push(
            queryClient.invalidateQueries({
              queryKey: adminAiGenerationQueryKeys.summary(lessonId),
            }),
            queryClient.invalidateQueries({
              queryKey: adminAiGenerationQueryKeys.stemFigures(lessonId),
            }),
          );
          break;
        case "LESSON_VIDEO_SUMMARY":
          refreshes.push(
            queryClient.invalidateQueries({
              queryKey: ["admin-video-summary", lessonId],
            }),
          );
          break;
        case "FLASHCARD_SET":
        case "FLASHCARD_FIGURE":
          refreshes.push(
            queryClient.invalidateQueries({ queryKey: ["admin", "flashcards"] }),
          );
          break;
        case "QUIZ_SET":
        case "TEST_SET":
        case "QUIZ_QUESTION":
        case "TEST_QUESTION":
        case "QUIZ_FIGURE":
        case "TEST_FIGURE":
          refreshes.push(
            queryClient.invalidateQueries({ queryKey: adminAssessmentQueryKeys.all }),
            queryClient.invalidateQueries({ queryKey: ["admin", "quiz"] }),
          );
          break;
        case "STEM_FIGURE":
          refreshes.push(
            queryClient.invalidateQueries({
              queryKey: adminAiGenerationQueryKeys.stemFigures(lessonId),
            }),
          );
          break;
        case "LESSON_DOCUMENT":
        case "lesson_document":
          refreshes.push(
            queryClient.invalidateQueries({ queryKey: ["admin-course-documents"] }),
          );
          break;
      }
    }
    void Promise.all(refreshes);
  }, 200);
}

function rememberEventId(eventIds: Set<string>, eventId: string) {
  eventIds.add(eventId);
  if (eventIds.size <= 500) return;
  const oldest = eventIds.values().next().value;
  if (typeof oldest === "string") eventIds.delete(oldest);
}
