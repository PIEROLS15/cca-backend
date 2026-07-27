-- CreateTable
CREATE TABLE "CommonerLicense" (
    "id" SERIAL NOT NULL,
    "dni" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "firstNames" TEXT NOT NULL,
    "lastNames" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "address" TEXT NOT NULL,
    "photoPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommonerLicense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommonerLicense_dni_key" ON "CommonerLicense"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "CommonerLicense_licenseNumber_key" ON "CommonerLicense"("licenseNumber");

-- CreateIndex
CREATE INDEX "CommonerLicense_dni_idx" ON "CommonerLicense"("dni");

-- CreateIndex
CREATE INDEX "CommonerLicense_licenseNumber_idx" ON "CommonerLicense"("licenseNumber");

-- CreateIndex
CREATE INDEX "CommonerLicense_fullName_idx" ON "CommonerLicense"("fullName");
