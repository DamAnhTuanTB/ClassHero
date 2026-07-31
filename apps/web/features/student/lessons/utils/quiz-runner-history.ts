import {
  getBrowserStudentLearningSurface,
  getStudentLearningSurfaceHref,
} from "@/features/student/lessons/utils/student-learning-surface-route";

const QUIZ_RUNNER_HISTORY_STATE_KEY = "__classheroQuizRunnerAttemptId";
const QUIZ_RESULT_HISTORY_STATE_KEY = "__classheroQuizResultAttemptId";
const QUIZ_RUNNER_SET_HISTORY_STATE_KEY = "__classheroQuizRunnerSetId";
const QUIZ_RESULT_SET_HISTORY_STATE_KEY = "__classheroQuizResultSetId";
const QUIZ_RUNNER_SET_STORAGE_KEY = "student-quiz-surface:runner-set";
const QUIZ_RESULT_SET_STORAGE_KEY = "student-quiz-surface:result-set";
const QUIZ_ACTIVE_SET_STORAGE_PREFIX = "student-quiz-active-set:";

export function getQuizRunnerHistoryAttemptId() {
  if (typeof window === "undefined") return null;

  const currentState = getCurrentHistoryState();
  const attemptId = currentState[QUIZ_RUNNER_HISTORY_STATE_KEY];
  if (typeof attemptId === "string") return attemptId;

  const routeSurface = getBrowserStudentLearningSurface();
  return routeSurface?.kind === "quiz-runner"
    ? routeSurface.attemptId
    : null;
}

export function getQuizResultHistoryAttemptId() {
  if (typeof window === "undefined") return null;

  const currentState = getCurrentHistoryState();
  const attemptId = currentState[QUIZ_RESULT_HISTORY_STATE_KEY];
  if (typeof attemptId === "string") return attemptId;

  const routeSurface = getBrowserStudentLearningSurface();
  return routeSurface?.kind === "quiz-result"
    ? routeSurface.attemptId
    : null;
}

export function getQuizRunnerHistorySetId() {
  if (typeof window === "undefined") return null;

  const setId = getCurrentHistoryState()[QUIZ_RUNNER_SET_HISTORY_STATE_KEY];
  if (typeof setId === "string") return setId;

  const routeSurface = getBrowserStudentLearningSurface();
  return routeSurface?.kind === "quiz-runner"
    ? routeSurface.setId
    : readSessionStorageString(QUIZ_RUNNER_SET_STORAGE_KEY);
}

export function getQuizResultHistorySetId() {
  if (typeof window === "undefined") return null;

  const setId = getCurrentHistoryState()[QUIZ_RESULT_SET_HISTORY_STATE_KEY];
  if (typeof setId === "string") return setId;

  const routeSurface = getBrowserStudentLearningSurface();
  return routeSurface?.kind === "quiz-result"
    ? routeSurface.setId
    : readSessionStorageString(QUIZ_RESULT_SET_STORAGE_KEY);
}

export function readStoredQuizActiveSetId(lessonId: string, userId?: string) {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(
      getQuizActiveSetStorageKey(lessonId, userId),
    );
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredQuizActiveSetId(
  lessonId: string,
  quizSetId: string,
  userId?: string,
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getQuizActiveSetStorageKey(lessonId, userId),
      quizSetId,
    );
  } catch {
    // The current React state remains usable when browser storage is unavailable.
  }
}

export function pushQuizRunnerHistoryEntry(attemptId: string, quizSetId: string) {
  if (typeof window === "undefined") return;

  const currentState = getCurrentHistoryState();
  const nextHref = getStudentLearningSurfaceHref({
    attemptId,
    kind: "quiz-runner",
    setId: quizSetId,
  });
  writeSessionStorageString(QUIZ_RUNNER_SET_STORAGE_KEY, quizSetId);
  removeSessionStorageValue(QUIZ_RESULT_SET_STORAGE_KEY);
  if (
    currentState[QUIZ_RUNNER_HISTORY_STATE_KEY] === attemptId &&
    currentState[QUIZ_RUNNER_SET_HISTORY_STATE_KEY] === quizSetId
  ) {
    if (getCurrentHref() !== nextHref) {
      window.history.replaceState(currentState, "", nextHref);
    }
    return;
  }

  const nextState = { ...currentState };
  delete nextState[QUIZ_RESULT_HISTORY_STATE_KEY];
  delete nextState[QUIZ_RESULT_SET_HISTORY_STATE_KEY];

  window.history.pushState(
    {
      ...nextState,
      [QUIZ_RUNNER_HISTORY_STATE_KEY]: attemptId,
      [QUIZ_RUNNER_SET_HISTORY_STATE_KEY]: quizSetId,
    },
    "",
    nextHref,
  );
}

export function setQuizResultHistoryMarker(attemptId: string, quizSetId?: string) {
  if (typeof window === "undefined") return;

  const nextState = { ...getCurrentHistoryState() };
  delete nextState[QUIZ_RUNNER_HISTORY_STATE_KEY];
  delete nextState[QUIZ_RUNNER_SET_HISTORY_STATE_KEY];
  nextState[QUIZ_RESULT_HISTORY_STATE_KEY] = attemptId;
  removeSessionStorageValue(QUIZ_RUNNER_SET_STORAGE_KEY);
  if (quizSetId) {
    nextState[QUIZ_RESULT_SET_HISTORY_STATE_KEY] = quizSetId;
    writeSessionStorageString(QUIZ_RESULT_SET_STORAGE_KEY, quizSetId);
  } else {
    delete nextState[QUIZ_RESULT_SET_HISTORY_STATE_KEY];
    removeSessionStorageValue(QUIZ_RESULT_SET_STORAGE_KEY);
  }
  window.history.replaceState(
    nextState,
    "",
    getStudentLearningSurfaceHref({
      attemptId,
      kind: "quiz-result",
      setId: quizSetId ?? getQuizResultHistorySetId() ?? "",
    }),
  );
}

export function popQuizRunnerHistoryEntryPreservingResult() {
  if (typeof window === "undefined") return;

  const resultAttemptId = getQuizResultHistoryAttemptId();
  const resultSetId = getQuizResultHistorySetId();
  if (!resultAttemptId) {
    window.history.back();
    return;
  }

  let cleanupTimeoutId = 0;
  const handlePopState = () => {
    window.clearTimeout(cleanupTimeoutId);
    setQuizResultHistoryMarker(resultAttemptId, resultSetId ?? undefined);
  };

  window.addEventListener("popstate", handlePopState, { once: true });
  cleanupTimeoutId = window.setTimeout(() => {
    window.removeEventListener("popstate", handlePopState);
  }, 1_000);
  window.history.back();
}

export function clearQuizRunnerHistoryMarker() {
  if (typeof window === "undefined") return;

  removeSessionStorageValue(QUIZ_RUNNER_SET_STORAGE_KEY);
  const currentState = getCurrentHistoryState();
  const routeSurface = getBrowserStudentLearningSurface();
  const shouldClearRoute = routeSurface?.kind === "quiz-runner";
  if (
    !(QUIZ_RUNNER_HISTORY_STATE_KEY in currentState) &&
    !(QUIZ_RUNNER_SET_HISTORY_STATE_KEY in currentState) &&
    !shouldClearRoute
  ) {
    return;
  }

  const nextState = { ...currentState };
  delete nextState[QUIZ_RUNNER_HISTORY_STATE_KEY];
  delete nextState[QUIZ_RUNNER_SET_HISTORY_STATE_KEY];
  window.history.replaceState(
    nextState,
    "",
    shouldClearRoute ? getStudentLearningSurfaceHref(null) : window.location.href,
  );
}

export function clearQuizResultHistoryMarker() {
  if (typeof window === "undefined") return;

  removeSessionStorageValue(QUIZ_RESULT_SET_STORAGE_KEY);
  const currentState = getCurrentHistoryState();
  const routeSurface = getBrowserStudentLearningSurface();
  const shouldClearRoute = routeSurface?.kind === "quiz-result";
  if (
    !(QUIZ_RESULT_HISTORY_STATE_KEY in currentState) &&
    !(QUIZ_RESULT_SET_HISTORY_STATE_KEY in currentState) &&
    !shouldClearRoute
  ) {
    return;
  }

  const nextState = { ...currentState };
  delete nextState[QUIZ_RESULT_HISTORY_STATE_KEY];
  delete nextState[QUIZ_RESULT_SET_HISTORY_STATE_KEY];
  window.history.replaceState(
    nextState,
    "",
    shouldClearRoute ? getStudentLearningSurfaceHref(null) : window.location.href,
  );
}

function readSessionStorageString(key: string) {
  try {
    const value = window.sessionStorage.getItem(key);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeSessionStorageString(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // History state still supports the active Quiz surface.
  }
}

function removeSessionStorageValue(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore unavailable browser storage during cleanup.
  }
}

function getQuizActiveSetStorageKey(lessonId: string, userId?: string) {
  return `${QUIZ_ACTIVE_SET_STORAGE_PREFIX}${userId ?? "guest"}:${lessonId}`;
}

function getCurrentHistoryState(): Record<string, unknown> {
  if (
    typeof window === "undefined" ||
    !window.history.state ||
    typeof window.history.state !== "object"
  ) {
    return {};
  }

  return window.history.state as Record<string, unknown>;
}

function getCurrentHref() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
