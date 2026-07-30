const FLASHCARD_RUNNER_HISTORY_STATE_KEY = "__classheroFlashcardRunnerSetId";
const FLASHCARD_RESULT_HISTORY_STATE_KEY = "__classheroFlashcardResultSetId";
const FLASHCARD_RUNNER_SURFACE_STORAGE_KEY = "student-flashcard-surface:runner";
const FLASHCARD_RESULT_SURFACE_STORAGE_KEY = "student-flashcard-surface:result";
const FLASHCARD_SESSION_STORAGE_PREFIX = "student-flashcard-session:";
const FLASHCARD_ACTIVE_SET_STORAGE_PREFIX = "student-flashcard-active-set:";

export type StoredFlashcardSession = {
  backDestination: "PANEL" | "RESULT";
  cardIds: string[];
  currentIndex: number;
  isBackVisible: boolean;
  resumesSavedProgress: boolean;
  reviewedCardIds: string[];
  sessionId?: string;
};

export function getFlashcardRunnerHistorySetId() {
  if (typeof window === "undefined") return null;

  const setId = getCurrentHistoryState()[FLASHCARD_RUNNER_HISTORY_STATE_KEY];
  return typeof setId === "string"
    ? setId
    : readSessionStorageString(FLASHCARD_RUNNER_SURFACE_STORAGE_KEY);
}

export function getFlashcardResultHistorySetId() {
  if (typeof window === "undefined") return null;

  const setId = getCurrentHistoryState()[FLASHCARD_RESULT_HISTORY_STATE_KEY];
  return typeof setId === "string"
    ? setId
    : readSessionStorageString(FLASHCARD_RESULT_SURFACE_STORAGE_KEY);
}

export function readStoredFlashcardActiveSetId(
  lessonId: string,
  userId?: string,
) {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(
      getFlashcardActiveSetStorageKey(lessonId, userId),
    );
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredFlashcardActiveSetId(
  lessonId: string,
  setId: string,
  userId?: string,
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getFlashcardActiveSetStorageKey(lessonId, userId),
      setId,
    );
  } catch {
    // The current React state remains usable when browser storage is unavailable.
  }
}

export function pushFlashcardRunnerHistoryEntry(setId: string) {
  if (typeof window === "undefined") return;

  const currentState = getCurrentHistoryState();
  writeSessionStorageString(FLASHCARD_RUNNER_SURFACE_STORAGE_KEY, setId);
  removeSessionStorageValue(FLASHCARD_RESULT_SURFACE_STORAGE_KEY);
  if (currentState[FLASHCARD_RUNNER_HISTORY_STATE_KEY] === setId) return;

  const nextState = { ...currentState };
  delete nextState[FLASHCARD_RESULT_HISTORY_STATE_KEY];
  window.history.pushState(
    {
      ...nextState,
      [FLASHCARD_RUNNER_HISTORY_STATE_KEY]: setId,
    },
    "",
    window.location.href,
  );
}

export function setFlashcardResultHistoryMarker(setId: string) {
  if (typeof window === "undefined") return;

  const nextState = { ...getCurrentHistoryState() };
  delete nextState[FLASHCARD_RUNNER_HISTORY_STATE_KEY];
  nextState[FLASHCARD_RESULT_HISTORY_STATE_KEY] = setId;
  writeSessionStorageString(FLASHCARD_RESULT_SURFACE_STORAGE_KEY, setId);
  removeSessionStorageValue(FLASHCARD_RUNNER_SURFACE_STORAGE_KEY);
  window.history.replaceState(nextState, "", window.location.href);
}

export function popFlashcardRunnerHistoryEntryPreservingResult() {
  if (typeof window === "undefined") return;

  const resultSetId = getFlashcardResultHistorySetId();
  if (!resultSetId) {
    window.history.back();
    return;
  }

  let cleanupTimeoutId = 0;
  const handlePopState = () => {
    window.clearTimeout(cleanupTimeoutId);
    setFlashcardResultHistoryMarker(resultSetId);
  };

  window.addEventListener("popstate", handlePopState, { once: true });
  cleanupTimeoutId = window.setTimeout(() => {
    window.removeEventListener("popstate", handlePopState);
  }, 1_000);
  window.history.back();
}

export function clearFlashcardResultHistoryMarker() {
  if (typeof window === "undefined") return;

  removeSessionStorageValue(FLASHCARD_RESULT_SURFACE_STORAGE_KEY);
  const currentState = getCurrentHistoryState();
  if (!(FLASHCARD_RESULT_HISTORY_STATE_KEY in currentState)) return;

  const nextState = { ...currentState };
  delete nextState[FLASHCARD_RESULT_HISTORY_STATE_KEY];
  window.history.replaceState(nextState, "", window.location.href);
}

export function clearFlashcardRunnerHistoryMarker() {
  if (typeof window === "undefined") return;

  removeSessionStorageValue(FLASHCARD_RUNNER_SURFACE_STORAGE_KEY);
  const currentState = getCurrentHistoryState();
  if (!(FLASHCARD_RUNNER_HISTORY_STATE_KEY in currentState)) return;

  const nextState = { ...currentState };
  delete nextState[FLASHCARD_RUNNER_HISTORY_STATE_KEY];
  window.history.replaceState(nextState, "", window.location.href);
}

export function readStoredFlashcardSession(
  setId: string,
  availableCardIds: ReadonlySet<string>,
): StoredFlashcardSession | null {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = window.localStorage.getItem(getFlashcardSessionStorageKey(setId));
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as unknown;
    if (!isStoredFlashcardSession(parsed, availableCardIds)) {
      clearStoredFlashcardSession(setId);
      return null;
    }
    return parsed;
  } catch {
    clearStoredFlashcardSession(setId);
    return null;
  }
}

export function writeStoredFlashcardSession(
  setId: string,
  session: StoredFlashcardSession,
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getFlashcardSessionStorageKey(setId),
      JSON.stringify(session),
    );
  } catch {
    // The in-memory runner remains usable when browser storage is unavailable.
  }
}

export function clearStoredFlashcardSession(setId: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(getFlashcardSessionStorageKey(setId));
  } catch {
    // Ignore unavailable browser storage during cleanup.
  }
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
    // History state still supports the active tab when storage is unavailable.
  }
}

function removeSessionStorageValue(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore unavailable browser storage during cleanup.
  }
}

function getFlashcardSessionStorageKey(setId: string) {
  return `${FLASHCARD_SESSION_STORAGE_PREFIX}${setId}`;
}

function getFlashcardActiveSetStorageKey(lessonId: string, userId?: string) {
  return `${FLASHCARD_ACTIVE_SET_STORAGE_PREFIX}${userId ?? "guest"}:${lessonId}`;
}

function isStoredFlashcardSession(
  value: unknown,
  availableCardIds: ReadonlySet<string>,
): value is StoredFlashcardSession {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<StoredFlashcardSession>;
  if (candidate.backDestination !== "PANEL" && candidate.backDestination !== "RESULT") {
    return false;
  }
  if (
    !Array.isArray(candidate.cardIds) ||
    candidate.cardIds.length === 0 ||
    candidate.cardIds.some(
      (cardId) => typeof cardId !== "string" || !availableCardIds.has(cardId),
    ) ||
    new Set(candidate.cardIds).size !== candidate.cardIds.length
  ) {
    return false;
  }
  if (
    !Array.isArray(candidate.reviewedCardIds) ||
    candidate.reviewedCardIds.some(
      (cardId) => typeof cardId !== "string" || !candidate.cardIds?.includes(cardId),
    )
  ) {
    return false;
  }
  if (
    !Number.isInteger(candidate.currentIndex) ||
    (candidate.currentIndex ?? -1) < 0 ||
    (candidate.currentIndex ?? 0) >= candidate.cardIds.length
  ) {
    return false;
  }

  return (
    typeof candidate.isBackVisible === "boolean" &&
    typeof candidate.resumesSavedProgress === "boolean" &&
    (candidate.sessionId === undefined || typeof candidate.sessionId === "string")
  );
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
