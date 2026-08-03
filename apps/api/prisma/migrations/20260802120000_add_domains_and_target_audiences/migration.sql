CREATE TABLE "domains" (
  "id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(140) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "target_audiences" (
  "id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "grade" INTEGER,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "target_audiences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "domains_slug_key" ON "domains"("slug");
CREATE UNIQUE INDEX "target_audiences_code_key" ON "target_audiences"("code");
CREATE UNIQUE INDEX "target_audiences_grade_key" ON "target_audiences"("grade");
CREATE INDEX "domains_sort_order_name_idx" ON "domains"("sort_order", "name");
CREATE INDEX "target_audiences_sort_order_name_idx" ON "target_audiences"("sort_order", "name");

INSERT INTO "domains" ("id", "name", "slug", "sort_order", "updated_at") VALUES
  ('10000000-0000-4000-8000-000000000001', 'Toán', 'toan', 1, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000002', 'Vật lý', 'vat-ly', 2, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000003', 'Hóa học', 'hoa-hoc', 3, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000004', 'Tiếng Anh', 'tieng-anh', 4, CURRENT_TIMESTAMP);

INSERT INTO "target_audiences" ("id", "code", "name", "grade", "sort_order", "updated_at") VALUES
  ('20000000-0000-4000-8000-000000000003', 'GRADE_3', 'Khối 3', 3, 3, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000004', 'GRADE_4', 'Khối 4', 4, 4, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000005', 'GRADE_5', 'Khối 5', 5, 5, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000006', 'GRADE_6', 'Khối 6', 6, 6, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000007', 'GRADE_7', 'Khối 7', 7, 7, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000008', 'GRADE_8', 'Khối 8', 8, 8, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000009', 'GRADE_9', 'Khối 9', 9, 9, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000010', 'GRADE_10', 'Khối 10', 10, 10, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000011', 'GRADE_11', 'Khối 11', 11, 11, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000012', 'GRADE_12', 'Khối 12', 12, 12, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000099', 'WORKING_ADULT', 'Người đi làm', NULL, 99, CURRENT_TIMESTAMP);

ALTER TABLE "learning_paths" ADD COLUMN "domain_id" UUID;
ALTER TABLE "learning_paths" ADD COLUMN "target_audience_id" UUID;

UPDATE "learning_paths"
SET "domain_id" = CASE "subject"::text
  WHEN 'MATH' THEN '10000000-0000-4000-8000-000000000001'::uuid
  WHEN 'PHYSICS' THEN '10000000-0000-4000-8000-000000000002'::uuid
  WHEN 'CHEMISTRY' THEN '10000000-0000-4000-8000-000000000003'::uuid
END,
"target_audience_id" = ('20000000-0000-4000-8000-0000000000' || lpad("grade"::text, 2, '0'))::uuid;

ALTER TABLE "learning_paths" ALTER COLUMN "domain_id" SET NOT NULL;
ALTER TABLE "learning_paths" ALTER COLUMN "target_audience_id" SET NOT NULL;
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_target_audience_id_fkey" FOREIGN KEY ("target_audience_id") REFERENCES "target_audiences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "learning_paths_domain_id_target_audience_id_idx" ON "learning_paths"("domain_id", "target_audience_id");
DROP INDEX IF EXISTS "learning_paths_subject_grade_idx";
ALTER TABLE "learning_paths" DROP COLUMN "subject";
ALTER TABLE "learning_paths" DROP COLUMN "grade";
DROP TYPE "Subject";
