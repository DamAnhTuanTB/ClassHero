ALTER TABLE "lessons"
ALTER COLUMN "chapter_id" DROP NOT NULL;

CREATE INDEX "lessons_learning_path_id_chapter_id_order_index_idx"
ON "lessons"("learning_path_id", "chapter_id", "order_index");

CREATE UNIQUE INDEX "lessons_ungrouped_learning_path_order_active_key"
ON "lessons"("learning_path_id", "order_index")
WHERE "chapter_id" IS NULL AND "deleted_at" IS NULL;
