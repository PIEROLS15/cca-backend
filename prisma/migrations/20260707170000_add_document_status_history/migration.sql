-- CreateTable
CREATE TABLE "DocumentStatusHistory" (
  "id" SERIAL NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentId" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT,
  "changedByUserId" INTEGER,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DocumentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DocumentStatusHistory"
ADD CONSTRAINT "DocumentStatusHistory_changedByUserId_fkey"
FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "DocumentStatusHistory_documentType_documentId_changedAt_idx"
ON "DocumentStatusHistory"("documentType", "documentId", "changedAt");

-- CreateIndex
CREATE INDEX "DocumentStatusHistory_documentType_documentId_status_idx"
ON "DocumentStatusHistory"("documentType", "documentId", "status");

-- Backfill certificates
INSERT INTO "DocumentStatusHistory" ("documentType", "documentId", "status", "changedByUserId", "changedAt")
SELECT 'certificate', c."id", c."status"::text, c."userId", c."createdAt"
FROM "Certificate" c;

-- Backfill certificate requests
INSERT INTO "DocumentStatusHistory" ("documentType", "documentId", "status", "changedByUserId", "changedAt")
SELECT 'certificate_request', r."id", r."status"::text, r."userId", r."createdAt"
FROM "CertificateRequest" r;

-- Backfill assembly record requests
INSERT INTO "DocumentStatusHistory" ("documentType", "documentId", "status", "changedByUserId", "changedAt")
SELECT 'assembly_record_request', a."id", a."status"::text, a."userId", a."createdAt"
FROM "AssemblyRecordRequest" a;
