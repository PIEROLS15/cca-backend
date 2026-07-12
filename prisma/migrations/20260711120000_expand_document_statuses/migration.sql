BEGIN;

CREATE TYPE "CertificateStatus_new" AS ENUM ('Recepcionado', 'PorFirmar', 'PorRecoger', 'Entregado', 'Observado');

CREATE TYPE "CertificateRequestStatus_new" AS ENUM ('Recepcionado', 'PorFirmar', 'PorRecoger', 'Entregado', 'Observado');

ALTER TABLE "Certificate"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "CertificateStatus_new"
  USING (
    CASE
      WHEN "status"::text = 'PorFirmar' THEN 'Recepcionado'
      ELSE "status"::text
    END
  )::"CertificateStatus_new";

ALTER TABLE "CertificateRequest"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "CertificateRequestStatus_new"
  USING (
    CASE
      WHEN "status"::text = 'EnProceso' THEN 'Recepcionado'
      ELSE "status"::text
    END
  )::"CertificateRequestStatus_new";

ALTER TABLE "Certificate"
  ALTER COLUMN "status" SET DEFAULT 'Recepcionado';

ALTER TABLE "CertificateRequest"
  ALTER COLUMN "status" SET DEFAULT 'Recepcionado';

DROP TYPE "CertificateStatus";
DROP TYPE "CertificateRequestStatus";

ALTER TYPE "CertificateStatus_new" RENAME TO "CertificateStatus";
ALTER TYPE "CertificateRequestStatus_new" RENAME TO "CertificateRequestStatus";

COMMIT;
