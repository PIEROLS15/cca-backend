const prisma = require("../src/config/prisma");
const { ensureBaseRoles } = require("../src/utils/role.utils");
const { createAuthUserFixture, removeAuthUserFixture, makeAuthToken } = require("./auth/auth.test-utils");

const SERIAL_TABLES = [
  "User",
  "Role",
  "Permission",
  "Client",
  "Commoner",
  "Sector",
  "TerrainTypeConfig",
  "TerrainType",
  "CertificateRequest",
  "Certificate",
  "AssemblyRecordRequest",
  "CertificateOwner",
  "DocumentStatusHistory",
];

const syncSerialSequences = async (tableNames = SERIAL_TABLES) => {
  for (const tableName of tableNames) {
    await prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('"${tableName}"', 'id'),
        COALESCE((SELECT MAX("id") FROM "${tableName}"), 1),
        (SELECT COUNT(*) > 0 FROM "${tableName}")
      )
    `);
  }
};

const createAdminAuthFixture = async (overrides = {}) => {
  await ensureBaseRoles();

  const role = await prisma.role.findUnique({ where: { name: overrides.roleName || "Admin" } });
  if (!role) {
    throw new Error("No se encontró el rol Admin en la DB de test");
  }

  return createAuthUserFixture({
    ...overrides,
    role,
  });
};

module.exports = {
  prisma,
  makeAuthToken,
  createAdminAuthFixture,
  removeAuthUserFixture,
  syncSerialSequences,
};
