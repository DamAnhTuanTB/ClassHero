ALTER TABLE "learning_paths"
ADD COLUMN "start_date" DATE,
ADD COLUMN "end_date" DATE,
ADD COLUMN "lesson_count_min" INTEGER,
ADD COLUMN "lesson_count_max" INTEGER;

ALTER TABLE "learning_paths"
ADD CONSTRAINT "learning_paths_date_range_valid"
CHECK ("end_date" IS NULL OR "start_date" IS NULL OR "end_date" >= "start_date");

ALTER TABLE "learning_paths"
ADD CONSTRAINT "learning_paths_lesson_count_range_valid"
CHECK (
  ("lesson_count_min" IS NULL OR "lesson_count_min" BETWEEN 1 AND 500)
  AND ("lesson_count_max" IS NULL OR "lesson_count_max" BETWEEN 1 AND 500)
  AND (
    "lesson_count_min" IS NULL
    OR "lesson_count_max" IS NULL
    OR "lesson_count_max" >= "lesson_count_min"
  )
);
