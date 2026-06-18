-- AlterTable
ALTER TABLE "User"
ADD COLUMN "certificateRangeStart" INTEGER,
ADD COLUMN "certificateRangeEnd" INTEGER,
ADD COLUMN "lastCertificate" INTEGER;
