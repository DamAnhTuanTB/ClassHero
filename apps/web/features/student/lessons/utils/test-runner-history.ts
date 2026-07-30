const TEST_RUNNER_HISTORY_STATE_KEY = "__classheroTestRunnerAttemptId";
const TEST_RUNNER_SET_HISTORY_STATE_KEY = "__classheroTestRunnerSetId";

export function pushTestRunnerHistoryEntry(attemptId: string, testSetId: string) {
  if (typeof window === "undefined") return;

  const currentState = getCurrentHistoryState();
  if (
    currentState[TEST_RUNNER_HISTORY_STATE_KEY] === attemptId &&
    currentState[TEST_RUNNER_SET_HISTORY_STATE_KEY] === testSetId
  ) {
    return;
  }

  window.history.pushState(
    {
      ...currentState,
      [TEST_RUNNER_HISTORY_STATE_KEY]: attemptId,
      [TEST_RUNNER_SET_HISTORY_STATE_KEY]: testSetId,
    },
    "",
    window.location.href,
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
