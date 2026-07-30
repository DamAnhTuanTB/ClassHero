"use client";

import { useCallback, useEffect, useRef } from "react";
import { saveQuizProgress } from "@/features/student/lessons/api/student-lessons-api";
import type {
  QuizProgressSnapshot,
  StudentAnswer,
} from "@/features/student/lessons/types/student-lesson-types";

type QuizProgressPayload = {
  attemptId: string;
  currentQuestionIndex: number;
  answer?: {
    questionId: string;
    answerJson: StudentAnswer;
    isChecked?: boolean;
  };
};

export function useQuizProgressAutosave({
  onError,
  onSaved,
  token,
}: {
  onError?: (error: unknown) => void;
  onSaved?: (snapshot: QuizProgressSnapshot) => void;
  token: string;
}) {
  const onErrorRef = useRef(onError);
  const onSavedRef = useRef(onSaved);
  const pendingRef = useRef<QuizProgressPayload | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const requestQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    onErrorRef.current = onError;
    onSavedRef.current = onSaved;
  }, [onError, onSaved]);

  const enqueue = useCallback(
    (payload: QuizProgressPayload, keepalive = false) => {
      if (keepalive) {
        return saveQuizProgress(
          payload.attemptId,
          {
            currentQuestionIndex: payload.currentQuestionIndex,
            answer: payload.answer,
          },
          token,
          { keepalive: true },
        )
          .then((snapshot) => {
            onSavedRef.current?.(snapshot);
          })
          .catch((error: unknown) => {
            onErrorRef.current?.(error);
          });
      }
      requestQueueRef.current = requestQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const snapshot = await saveQuizProgress(
            payload.attemptId,
            {
              currentQuestionIndex: payload.currentQuestionIndex,
              answer: payload.answer,
            },
            token,
            { keepalive },
          );
          onSavedRef.current?.(snapshot);
        })
        .catch((error: unknown) => {
          onErrorRef.current?.(error);
        });
      return requestQueueRef.current;
    },
    [token],
  );

  const flush = useCallback(
    (keepalive = false) => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      const payload = pendingRef.current;
      pendingRef.current = null;
      return payload ? enqueue(payload, keepalive) : requestQueueRef.current;
    },
    [enqueue],
  );

  const saveAnswer = useCallback(
    (payload: QuizProgressPayload, debounceMs = 0) => {
      const pending = pendingRef.current;
      if (
        pending &&
        (pending.attemptId !== payload.attemptId ||
          pending.answer?.questionId !== payload.answer?.questionId)
      ) {
        void flush();
      } else if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      pendingRef.current = payload;
      if (debounceMs <= 0) {
        return flush();
      }
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        void flush();
      }, debounceMs);
      return requestQueueRef.current;
    },
    [flush],
  );

  const savePosition = useCallback(
    (attemptId: string, currentQuestionIndex: number) => {
      if (pendingRef.current?.attemptId === attemptId) {
        pendingRef.current = {
          ...pendingRef.current,
          currentQuestionIndex,
        };
        return flush();
      }
      return enqueue({ attemptId, currentQuestionIndex });
    },
    [enqueue, flush],
  );

  const cancel = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      void flush(true);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      void flush(true);
    };
  }, [flush]);

  return {
    cancel,
    flush,
    saveAnswer,
    savePosition,
  };
}
