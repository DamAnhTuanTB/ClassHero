CREATE TABLE "learning_path_target_audiences" (
  "learning_path_id" UUID NOT NULL,
  "target_audience_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "learning_path_target_audiences_pkey"
    PRIMARY KEY ("learning_path_id", "target_audience_id")
);

INSERT INTO "learning_path_target_audiences" (
  "learning_path_id",
  "target_audience_id"
)
SELECT "id", "target_audience_id"
FROM "learning_paths";

CREATE INDEX "learning_path_target_audiences_target_audience_id_learning_path_id_idx"
  ON "learning_path_target_audiences"("target_audience_id", "learning_path_id");

ALTER TABLE "learning_path_target_audiences"
  ADD CONSTRAINT "learning_path_target_audiences_learning_path_id_fkey"
  FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning_path_target_audiences"
  ADD CONSTRAINT "learning_path_target_audiences_target_audience_id_fkey"
  FOREIGN KEY ("target_audience_id") REFERENCES "target_audiences"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "learning_paths"
  DROP CONSTRAINT "learning_paths_target_audience_id_fkey";

DROP INDEX "learning_paths_domain_id_target_audience_id_idx";

ALTER TABLE "learning_paths"
  DROP COLUMN "target_audience_id";

CREATE INDEX "learning_paths_domain_id_idx" ON "learning_paths"("domain_id");
