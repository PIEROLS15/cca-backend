const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const prisma = require("../../src/config/prisma");

const AUTH_PAYLOAD = {
  sub: 1,
  role: "Admin",
  roleGroup: 1,
  username: "integration-test",
};

const getJwtSecret = () => process.env.JWT_SECRET || "dev-secret";

const makeAuthToken = (overrides = {}) => jwt.sign(
  {
    ...AUTH_PAYLOAD,
    ...overrides,
  },
  getJwtSecret(),
  { expiresIn: "1h" }
);

const getBaseContext = async () => {
  const [user, certificate] = await Promise.all([
    prisma.user.findFirst({
      orderBy: { id: "asc" },
      select: { id: true, username: true, fullName: true },
    }),
    prisma.certificate.findFirst({
      orderBy: { id: "asc" },
      include: {
        client: { include: { commoner: true } },
        sector: true,
        terrainType: true,
        user: true,
      },
    }),
  ]);

  if (!user) {
    throw new Error("No se encontró un usuario base en la DB de test");
  }

  if (!certificate) {
    throw new Error("No se encontró un certificado base en la DB de test");
  }

  return { user, certificate };
};

const createAssemblyRecordRequestFixture = async ({
  code = `IT-ARQ-${crypto.randomUUID()}`,
  description = `Fixture ${crypto.randomUUID()}`,
  buyerFullName,
  sellerFullName = "Vendedor de prueba",
  sectorLocation,
  terrainType,
  awardDate = new Date("2024-03-01T00:00:00.000Z"),
  possessionTime = "5 years",
  email = "fixture@example.com",
  phone = "999999999",
  attachments = [{ type: "CertPosesion" }, { type: "PlanoMemoria" }],
  legacyPayload = { typeUser: "comunero" },
  status = "EnProceso",
  userId,
  clientId,
  certificateId,
} = {}) => {
  const { user, certificate } = await getBaseContext();

  const resolvedCertificateId = certificateId || certificate.id;
  const resolvedClientId = clientId || certificate.clientId;
  const resolvedUserId = userId ?? user.id;

  const created = await prisma.assemblyRecordRequest.create({
    data: {
      code,
      clientId: resolvedClientId,
      certificateId: resolvedCertificateId,
      userId: resolvedUserId,
      description,
      buyerFullName: buyerFullName || certificate.client?.fullName || null,
      sellerFullName,
      sectorLocation: sectorLocation || certificate.sector?.name || null,
      terrainType: terrainType || certificate.terrainType?.name || null,
      awardDate,
      possessionTime,
      email,
      phone,
      attachments,
      legacyPayload,
      status,
    },
    include: {
      client: { include: { commoner: true } },
      certificate: { include: { sector: true, terrainType: true } },
      user: true,
    },
  });

  return created;
};

const removeAssemblyRecordRequestFixture = async (id) => {
  if (!id) return;

  await prisma.documentStatusHistory.deleteMany({
    where: {
      documentType: "assembly_record_request",
      documentId: id,
    },
  });

  await prisma.assemblyRecordRequest.deleteMany({
    where: { id },
  });
};

module.exports = {
  makeAuthToken,
  getBaseContext,
  createAssemblyRecordRequestFixture,
  removeAssemblyRecordRequestFixture,
};
