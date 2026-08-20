-- Identical previews are legitimate: a consumed/expired immutable draft must
-- not prevent an admin from explicitly submitting the same request again.
DROP INDEX IF EXISTS "lesson_summary_request_drafts_request_hash_key";
CREATE INDEX "lesson_summary_request_drafts_request_hash_idx"
  ON "lesson_summary_request_drafts"("request_hash");
