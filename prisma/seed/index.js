require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { createSeedApiClient } = require("./api-client");
const { seedRoles, syncRoleSequence } = require("./roles");
const { seedUsers, syncUserSequence } = require("./users");
const { seedSectors } = require("./sectors");
const { seedTerrainTypes } = require("./terrain-types");
const { seedClients, syncClientSequence } = require("./clients");
const { seedCertificateRequests } = require("./certificate-requests");
const { seedCertificates } = require("./certificates");
const { assignCertificateRanges } = require("./assign-certificate-ranges");
const { seedAssemblyRecordRequests } = require("./assembly-record-requests");

const prisma = new PrismaClient();

const SEEDERS = [
  { name: "Roles", fn: seedRoles },
  { name: "Usuarios", fn: seedUsers },
  { name: "Clientes", fn: seedClients },
  { name: "Sectores", fn: seedSectors },
  { name: "Tipos de terreno", fn: seedTerrainTypes },
  { name: "Solicitudes de certificados", fn: seedCertificateRequests },
  { name: "Certificados", fn: seedCertificates },
  { name: "Solicitudes de acta de asamblea", fn: seedAssemblyRecordRequests },
];

(async () => {
  const api = await createSeedApiClient();

  for (const { name, fn } of SEEDERS) {
    console.log(`\nEjecutando seed: ${name}`);
    await fn(prisma, api);
  }

  await assignCertificateRanges(prisma);
  await syncRoleSequence(prisma);
  await syncUserSequence(prisma);
  await syncClientSequence(prisma);

  console.log("\n✓ Todos los seeds ejecutados exitosamente");
})().catch((e) => {
  console.error("Error en seed:", e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
