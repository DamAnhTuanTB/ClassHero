-- Add lesson-level trial toggle for admin lesson management.

ALTER TABLE "lessons"
ADD COLUMN "trial_enabled" BOOLEAN NOT NULL DEFAULT false;

WITH first_trial_lessons AS (
    SELECT DISTINCT ON ("lessons"."learning_path_id")
        "lessons"."id"
    FROM "lessons"
    INNER JOIN "learning_paths"
        ON "learning_paths"."id" = "lessons"."learning_path_id"
    WHERE "learning_paths"."trial_enabled" = true
      AND "lessons"."deleted_at" IS NULL
    ORDER BY
        "lessons"."learning_path_id",
        "lessons"."order_index" ASC,
        "lessons"."created_at" ASC
)
UPDATE "lessons"
SET "trial_enabled" = true
FROM first_trial_lessons
WHERE "lessons"."id" = first_trial_lessons."id";
