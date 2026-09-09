ALTER TABLE "flashcard_generation_request_drafts"
ADD COLUMN "packet_hash" TEXT,
ADD COLUMN "manifest_hash" TEXT,
ADD COLUMN "packet_object_key" TEXT,
ADD COLUMN "packet_filename" TEXT,
ADD COLUMN "packet_size_bytes" BIGINT,
ADD COLUMN "packet_page_count" INTEGER,
ADD COLUMN "manifest_json" JSONB;
