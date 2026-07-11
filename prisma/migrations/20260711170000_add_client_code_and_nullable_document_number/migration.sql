-- AlterTable
ALTER TABLE "Client" ADD COLUMN "clientCode" TEXT;

-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "documentNumber" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Client_clientCode_key" ON "Client"("clientCode");
