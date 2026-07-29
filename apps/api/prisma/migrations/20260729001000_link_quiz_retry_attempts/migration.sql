ALTER TABLE "quiz_attempts"
ADD COLUMN "source_attempt_id" UUID;

CREATE INDEX "quiz_attempts_source_attempt_id_idx"
ON "quiz_attempts"("source_attempt_id");

ALTER TABLE "quiz_attempts"
ADD CONSTRAINT "quiz_attempts_source_attempt_id_fkey"
FOREIGN KEY ("source_attempt_id")
REFERENCES "quiz_attempts"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
