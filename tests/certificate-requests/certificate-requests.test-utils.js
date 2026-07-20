const crypto = require("crypto");
const prisma = require("../../src/config/prisma");
const { createAccessToken } = require("../../src/api/auth/utils/auth.utils");

const uniqueSuffix = () => `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

const getAuthUser = async () => {
  const user = await prisma.user.findFirst({
    where: { isActive: true },
    orderBy: { id: "asc" },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new Error("No se encontró un usuario activo en la DB de test");
  }

  return user;
};

const makeAuthToken = (user) => createAccessToken(user);

const getBaseClient = async (excludeId) => {
  const client = await prisma.client.findFirst({
    where: excludeId ? { id: { not: excludeId } } : undefined,
    orderBy: { id: "asc" },
  });

  if (!client) {
    throw new Error("No se encontró un cliente base en la DB de test");
  }

  return client;
};

const createCertificateRequestFixture = async (overrides = {}) => {
  const authUser = overrides.authUser || await getAuthUser();
  const suffix = uniqueSuffix();

  const client = overrides.clientId
    ? await prisma.client.findUnique({ where: { id: overrides.clientId } })
    : await getBaseClient();

  if (!client) {
    throw new Error("No se encontró un cliente base en la DB de test");
  }

  const partner = overrides.partnerId
    ? await prisma.client.findUnique({ where: { id: overrides.partnerId } })
    : null;

  const request = await prisma.certificateRequest.create({
    data: {
      requestNumber: overrides.requestNumber || `IT-CR-${suffix}`,
      clientId: client.id,
      userId: authUser.id,
      partnerId: partner?.id || null,
      description: overrides.description || `Solicitud de prueba ${suffix}`,
      destination: overrides.destination || "Secretaria",
      requestDescription: overrides.requestDescription || `Detalle ${suffix}`,
      sectorLocation: overrides.sectorLocation || "Sector de prueba",
      certificateTypes: overrides.certificateTypes || [{ type: "CertificadoPosesion" }],
      exposure: overrides.exposure || "Norte",
      attachments: overrides.attachments || [{ type: "CopiaDni" }],
      legacyPayload: overrides.legacyPayload || null,
      status: overrides.status || "Recepcionado",
    },
    include: {
      client: { include: { commoner: true } },
      partner: { include: { commoner: true } },
      user: { include: { role: true } },
    },
  });

  return {
    authUser,
    client: request.client,
    partner: request.partner,
    request,
    ownedClientIds: [],
  };
};

const removeCertificateRequestFixture = async (fixtureOrId) => {
  if (!fixtureOrId) return;

  const id = typeof fixtureOrId === "object" ? fixtureOrId.request?.id : fixtureOrId;
  const ownedClientIds = typeof fixtureOrId === "object" ? fixtureOrId.ownedClientIds || [] : [];

  if (id) {
    await prisma.documentStatusHistory.deleteMany({
      where: {
        documentType: "certificate_request",
        documentId: id,
      },
    });

    await prisma.certificateRequest.deleteMany({ where: { id } });
  }

  const uniqueClientIds = [...new Set(ownedClientIds.filter(Boolean))];
  if (uniqueClientIds.length > 0) {
    await prisma.client.deleteMany({ where: { id: { in: uniqueClientIds } } });
  }
};

module.exports = {
  makeAuthToken,
  getAuthUser,
  createCertificateRequestFixture,
  removeCertificateRequestFixture,
};
