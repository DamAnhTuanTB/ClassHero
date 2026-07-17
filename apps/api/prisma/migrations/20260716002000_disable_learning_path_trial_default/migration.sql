-- Learning paths must not grant trial access by default.
-- Trial access is controlled only by lessons.trial_enabled.

ALTER TABLE "learning_paths"
ALTER COLUMN "trial_enabled" SET DEFAULT false;

UPDATE "lessons"
SET "trial_enabled" = false
WHERE "trial_enabled" = true
  AND EXISTS (
    SELECT 1
    FROM "learning_paths"
    WHERE "learning_paths"."id" = "lessons"."learning_path_id"
      AND "learning_paths"."trial_enabled" = true
  );

UPDATE "learning_paths"
SET "trial_enabled" = false
WHERE "trial_enabled" = true;
