-- CreateEnum
CREATE TYPE "public"."ClientType" AS ENUM ('Comunero', 'Tercero');

-- CreateEnum
CREATE TYPE "public"."CertificateStatus" AS ENUM ('PorFirmar', 'PorRecoger', 'Entregado');

-- CreateEnum
CREATE TYPE "public"."RequestStatus" AS ENUM ('Pendiente', 'Aprobada', 'Rechazada');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "dni" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "roleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Permission" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RolePermission" (
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "public"."Sector" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TerrainType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerrainType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "clientType" "public"."ClientType" NOT NULL,
    "licenseSequence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CertificateRequest" (
    "id" SERIAL NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "userId" INTEGER,
    "partnerId" INTEGER,
    "description" TEXT,
    "destination" TEXT,
    "requestDescription" TEXT,
    "sectorLocation" TEXT,
    "certificateTypes" JSONB,
    "exposure" TEXT,
    "attachments" JSONB,
    "status" "public"."RequestStatus" NOT NULL DEFAULT 'Pendiente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Certificate" (
    "id" SERIAL NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "partnerId" INTEGER,
    "sectorId" INTEGER NOT NULL,
    "terrainTypeId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "width" DECIMAL(10,2),
    "length" DECIMAL(10,2),
    "totalArea" DECIMAL(10,2),
    "mz" TEXT,
    "lot" TEXT,
    "north" TEXT,
    "south" TEXT,
    "east" TEXT,
    "west" TEXT,
    "status" "public"."CertificateStatus" NOT NULL DEFAULT 'PorFirmar',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssemblyRecordRequest" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "certificateId" INTEGER NOT NULL,
    "userId" INTEGER,
    "description" TEXT,
    "status" "public"."RequestStatus" NOT NULL DEFAULT 'Pendiente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssemblyRecordRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_dni_key" ON "public"."User"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "public"."Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "public"."Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Sector_name_key" ON "public"."Sector"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TerrainType_name_key" ON "public"."TerrainType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Client_documentNumber_key" ON "public"."Client"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Client_licenseSequence_key" ON "public"."Client"("licenseSequence");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateRequest_requestNumber_key" ON "public"."CertificateRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_certificateNumber_key" ON "public"."Certificate"("certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AssemblyRecordRequest_code_key" ON "public"."AssemblyRecordRequest"("code");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "public"."Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CertificateRequest" ADD CONSTRAINT "CertificateRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CertificateRequest" ADD CONSTRAINT "CertificateRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CertificateRequest" ADD CONSTRAINT "CertificateRequest_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Certificate" ADD CONSTRAINT "Certificate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Certificate" ADD CONSTRAINT "Certificate_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Certificate" ADD CONSTRAINT "Certificate_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "public"."Sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Certificate" ADD CONSTRAINT "Certificate_terrainTypeId_fkey" FOREIGN KEY ("terrainTypeId") REFERENCES "public"."TerrainType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Certificate" ADD CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssemblyRecordRequest" ADD CONSTRAINT "AssemblyRecordRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssemblyRecordRequest" ADD CONSTRAINT "AssemblyRecordRequest_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "public"."Certificate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssemblyRecordRequest" ADD CONSTRAINT "AssemblyRecordRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
