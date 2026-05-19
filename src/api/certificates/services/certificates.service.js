const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const { buildCertificateCode, buildCertificateFilters } = require("../utils/certificates.utils");

const nextCorrelative = async () => {
  const lastCertificate = await prisma.certificate.findFirst({
    orderBy: { correlative: "desc" },
    select: { correlative: true },
  });

  return (lastCertificate?.correlative || 0) + 1;
};

const listCertificates = async (query) => {
  const pagination = getPaginationParams(query);
  const where = buildCertificateFilters(query);

  const [docs, total] = await Promise.all([
    prisma.certificate.findMany({
      where,
      include: {
        client: true,
        request: true,
        sector: true,
        terrainType: true,
      },
      orderBy: { id: "desc" },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.certificate.count({ where }),
  ]);

  return buildPaginationResult({
    docs,
    total,
    page: pagination.page,
    limit: pagination.limit,
  });
};

const getCertificateById = async (id) => {
  const certificate = await prisma.certificate.findUnique({
    where: { id },
    include: {
      client: true,
      request: true,
      sector: true,
      terrainType: true,
    },
  });

  if (!certificate) {
    throw new HttpError(404, "Certificado no encontrado");
  }

  return certificate;
};

const createCertificate = async (payload) => {
  const client = await prisma.client.findUnique({ where: { id: payload.clientId } });
  if (!client) {
    throw new HttpError(404, "Cliente no encontrado");
  }

  if (payload.requestId) {
    const request = await prisma.certificateRequest.findUnique({ where: { id: payload.requestId } });
    if (!request) {
      throw new HttpError(404, "Solicitud de certificado no encontrada");
    }
  }

  const correlative = await nextCorrelative();
  const code = buildCertificateCode(correlative);

  return prisma.certificate.create({
    data: {
      code,
      correlative,
      clientId: payload.clientId,
      requestId: payload.requestId || null,
      sectorId: payload.sectorId || null,
      terrainTypeId: payload.terrainTypeId || null,
      location: payload.location || null,
      mz: payload.mz || null,
      lot: payload.lot || null,
      status: payload.status || "PorFirmar",
      issuedAt: payload.issuedAt ? new Date(payload.issuedAt) : null,
      deliveredAt: payload.deliveredAt ? new Date(payload.deliveredAt) : null,
    },
    include: {
      client: true,
      request: true,
      sector: true,
      terrainType: true,
    },
  });
};

const updateCertificate = async (id, payload) => {
  await getCertificateById(id);

  return prisma.certificate.update({
    where: { id },
    data: {
      sectorId: payload.sectorId,
      terrainTypeId: payload.terrainTypeId,
      location: payload.location,
      mz: payload.mz,
      lot: payload.lot,
      status: payload.status,
      issuedAt: payload.issuedAt ? new Date(payload.issuedAt) : null,
      deliveredAt: payload.deliveredAt ? new Date(payload.deliveredAt) : null,
    },
    include: {
      client: true,
      request: true,
      sector: true,
      terrainType: true,
    },
  });
};

const deleteCertificate = async (id) => {
  await getCertificateById(id);
  await prisma.certificate.delete({ where: { id } });
};

module.exports = {
  listCertificates,
  getCertificateById,
  createCertificate,
  updateCertificate,
  deleteCertificate,
};
