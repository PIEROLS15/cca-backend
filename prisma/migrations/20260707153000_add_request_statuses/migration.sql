-- CreateEnum
CREATE TYPE "CertificateRequestStatus" AS ENUM ('EnProceso', 'Observado', 'Recepcionado');

-- CreateEnum
CREATE TYPE "AssemblyRecordRequestStatus" AS ENUM ('EnProceso', 'PorRecoger', 'Entregado');

-- AlterTable
ALTER TABLE "CertificateRequest"
ADD COLUMN "status" "CertificateRequestStatus" NOT NULL DEFAULT 'EnProceso';

UPDATE "CertificateRequest"
SET "status" = 'EnProceso';

-- AlterTable
ALTER TABLE "AssemblyRecordRequest"
ADD COLUMN "status" "AssemblyRecordRequestStatus" NOT NULL DEFAULT 'EnProceso';

UPDATE "AssemblyRecordRequest"
SET "status" = 'EnProceso';
