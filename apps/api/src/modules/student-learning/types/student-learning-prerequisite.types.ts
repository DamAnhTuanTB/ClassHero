export type StudentTestLockReason =
  "TRIAL_NOT_ALLOWED" | "BEFORE_OPEN_TIME" | "PREREQUISITES_INCOMPLETE" | null;

export type StudentTestPrerequisiteStatus = {
  canStart: boolean;
  examOpenAt: Date | null;
  evaluatedAt: Date;
  lockReason: StudentTestLockReason;
  quiz: {
    isRequired: boolean;
    isCompleted: boolean;
  };
  flashcard: {
    isRequired: boolean;
    isCompleted: boolean;
  };
};
