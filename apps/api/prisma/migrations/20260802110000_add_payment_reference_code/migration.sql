ALTER TABLE "payments"
ADD COLUMN "reference_code" TEXT;

CREATE UNIQUE INDEX "payments_reference_code_key"
ON "payments"("reference_code");
