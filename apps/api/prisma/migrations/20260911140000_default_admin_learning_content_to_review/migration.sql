-- New Admin content stays private and unreviewed until explicit review and
-- publication actions promote it. Existing rows are intentionally unchanged.
ALTER TABLE "quiz_sets"
ALTER COLUMN "review_status" SET DEFAULT 'DRAFT';

ALTER TABLE "flashcard_sets"
ALTER COLUMN "review_status" SET DEFAULT 'DRAFT';

ALTER TABLE "test_sets"
ALTER COLUMN "review_status" SET DEFAULT 'DRAFT';

ALTER TABLE "quiz_questions"
ALTER COLUMN "review_status" SET DEFAULT 'NEEDS_REVIEW';

ALTER TABLE "flashcards"
ALTER COLUMN "review_status" SET DEFAULT 'NEEDS_REVIEW';

ALTER TABLE "test_questions"
ALTER COLUMN "review_status" SET DEFAULT 'NEEDS_REVIEW';
