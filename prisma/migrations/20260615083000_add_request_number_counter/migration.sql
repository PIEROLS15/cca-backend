-- CreateTable
CREATE TABLE "RequestNumberCounter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestNumberCounter_pkey" PRIMARY KEY ("key")
);

-- Seed counter for certificate requests
INSERT INTO "RequestNumberCounter" ("key", "value", "updatedAt")
VALUES ('certificate-request', 0, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE
SET "value" = EXCLUDED."value",
    "updatedAt" = EXCLUDED."updatedAt";
