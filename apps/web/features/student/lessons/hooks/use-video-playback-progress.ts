"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveStudentVideoProgress } from "@/features/student/lessons/api/student-lessons-api";
import type { StudentVideoProgress } from "@/features/student/lessons/types/student-lesson-types";
import {
  getVideoProgressStorageKey,
  parseStoredVideoProgress,
  resolveVideoResumePosition,
  type StoredVideoProgress,
} from "@/lib/video-playback-resume";

const REMOTE_SAVE_INTERVAL_MS = 10_000;

export type VideoPlaybackState = "playing" | "paused" | "ended";

export function useVideoPlaybackProgress({
  initialProgress,
  lessonId,
  token,
  userId,
}: {
  initialProgress: StudentVideoProgress;
  lessonId: string;
  token: string;
  userId?: string;
}) {
  const initialPosition = resolveVideoResumePosition(initialProgress.lastPositionSeconds);
  const [resumePositionSeconds, setResumePositionSeconds] = useState<number | null>(
    initialPosition,
  );
  const latestPositionRef = useRef(initialPosition ?? 0);
  const lastRemotePositionRef = useRef(initialPosition ?? 0);
  const lastLocalSecondRef = useRef(Math.floor(initialPosition ?? 0));
  const hasStartedRef = useRef(false);
  const isDirtyRef = useRef(false);

  const storageKey =
    userId && initialProgress.timelineVersion
      ? getVideoProgressStorageKey({
          lessonId,
          timelineVersion: initialProgress.timelineVersion,
          userId,
        })
      : null;

  useEffect(() => {
    const serverPosition = resolveVideoResumePosition(
      initialProgress.lastPositionSeconds,
    );
    let nextPosition = serverPosition;

    if (storageKey) {
      let stored: StoredVideoProgress | null = null;
      try {
        stored = parseStoredVideoProgress(window.localStorage.getItem(storageKey));
      } catch {
        // Browser storage can be unavailable; remote persistence still works.
      }
      const serverSavedAt = initialProgress.updatedAt
        ? Date.parse(initialProgress.updatedAt)
        : Number.NEGATIVE_INFINITY;
      const localSavedAt = stored ? Date.parse(stored.savedAt) : Number.NEGATIVE_INFINITY;
      if (stored && localSavedAt > serverSavedAt) {
        nextPosition = resolveVideoResumePosition(stored.positionSeconds);
      }
    }

    const normalizedPosition = nextPosition ?? 0;
    setResumePositionSeconds(nextPosition);
    latestPositionRef.current = normalizedPosition;
    lastRemotePositionRef.current = serverPosition ?? 0;
    lastLocalSecondRef.current = Math.floor(normalizedPosition);
    hasStartedRef.current = false;
    isDirtyRef.current = false;
  }, [
    initialProgress.lastPositionSeconds,
    initialProgress.updatedAt,
    lessonId,
    storageKey,
  ]);

  const saveRemote = useCallback(
    (keepalive = false) => {
      if (!hasStartedRef.current || !isDirtyRef.current || !token) {
        return Promise.resolve<StudentVideoProgress | null>(null);
      }

      const positionSeconds = latestPositionRef.current;
      isDirtyRef.current = false;
      return saveStudentVideoProgress(lessonId, positionSeconds, token, {
        keepalive,
      })
        .then((progress) => {
          lastRemotePositionRef.current = positionSeconds;
          return progress;
        })
        .catch(() => {
          if (latestPositionRef.current === positionSeconds) {
            isDirtyRef.current = true;
          }
          return null;
        });
    },
    [lessonId, token],
  );

  const trackPosition = useCallback(
    (positionSeconds: number) => {
      if (
        !hasStartedRef.current ||
        !Number.isFinite(positionSeconds) ||
        positionSeconds < 0
      ) {
        return;
      }

      latestPositionRef.current = positionSeconds;
      isDirtyRef.current =
        Math.abs(positionSeconds - lastRemotePositionRef.current) >= 0.1;

      const wholeSecond = Math.floor(positionSeconds);
      if (!storageKey || wholeSecond === lastLocalSecondRef.current) return;

      lastLocalSecondRef.current = wholeSecond;
      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({
            positionSeconds,
            savedAt: new Date().toISOString(),
          }),
        );
      } catch {
        // Keep playback responsive if browser storage is unavailable or full.
      }
    },
    [storageKey],
  );

  const handlePlaybackStateChange = useCallback(
    (state: VideoPlaybackState) => {
      if (state === "playing") {
        hasStartedRef.current = true;
        return;
      }

      if (hasStartedRef.current) {
        void saveRemote();
      }
    },
    [saveRemote],
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void saveRemote();
    }, REMOTE_SAVE_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [saveRemote]);

  useEffect(() => {
    const handlePageHide = () => {
      void saveRemote(true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void saveRemote(true);
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void saveRemote(true);
    };
  }, [saveRemote]);

  return {
    handlePlaybackStateChange,
    resumePositionSeconds,
    trackPosition,
  };
}
