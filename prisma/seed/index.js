require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { seedRoles } = require("./roles");
const { seedUsers } = require("./users");
const { migrateUsers } = require("./migrate-users");
const { seedSectors } = require("./sectors");
const { seedTerrainTypes } = require("./terrain-types");
const { seedClients } = require("./clients");
const { seedCertificateRequests } = require("./certificate-requests");
const { seedCertificates } = require("./certificates");
const { seedAssemblyRecordRequests } = require("./assembly-record-requests");

const prisma = new PrismaClient();

const SEEDERS = [
  { name: "Roles", fn: seedRoles },
  { name: "Usuarios", fn: seedUsers },
  { name: "Sectores", fn: seedSectors },
  { name: "Tipos de terreno", fn: seedTerrainTypes },
  { name: "Clientes", fn: seedClients },
  { name: "Migrar usuarios anteriores", fn: migrateUsers },
  { name: "Solicitudes de certificados", fn: seedCertificateRequests },
  { name: "Certificados", fn: seedCertificates },
  { name: "Solicitudes de acta de asamblea", fn: seedAssemblyRecordRequests },
];

(async () => {
  for (const { name, fn } of SEEDERS) {
    console.log(`\nEjecutando seed: ${name}`);
    await fn(prisma);
  }
  console.log("\n✓ Todos los seeds ejecutados exitosamente");
})().catch((e) => {
  console.error("Error en seed:", e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
