import { expect, test } from "@playwright/test";
import { getNextLearningSet } from "../features/student/lessons/utils/learning-set-selection";

test("learning set selection skips empty sets and wraps to the first available set", () => {
  const sets = [
    { id: "set-1", questionCount: 10 },
    { id: "set-2", questionCount: 2 },
    { id: "set-3", questionCount: 0 },
  ];
  const hasQuestions = (set: (typeof sets)[number]) => set.questionCount > 0;

  expect(getNextLearningSet(sets, "set-1", hasQuestions).id).toBe("set-2");
  expect(getNextLearningSet(sets, "set-2", hasQuestions).id).toBe("set-1");
});

test("learning set selection reuses the current set when it is the only available set", () => {
  const sets = [
    { id: "set-1", questionCount: 0 },
    { id: "set-2", questionCount: 2 },
    { id: "set-3", questionCount: 0 },
  ];

  expect(getNextLearningSet(sets, "set-2", (set) => set.questionCount > 0).id).toBe(
    "set-2",
  );
});
