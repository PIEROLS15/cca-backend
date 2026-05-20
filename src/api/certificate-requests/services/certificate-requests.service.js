const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const {
  buildRequestCode,
  buildRequestNumber,
  normalizeValueToken,
  normalizeCertificateTypes,
  normalizeAttachments,
  formatCertificateRequestResponse,
} = require("../utils/certificate-requests.utils");

const nextRequestCode = async () => {
  const lastRequest = await prisma.certificateRequest.findFirst({
    orderBy: { id: "desc" },
    select: { id: true },
  });

  const nextSequence = (lastRequest?.id || 0) + 1;
  return {
    code: buildRequestCode(nextSequence),
    requestNumber: buildRequestNumber(nextSequence),
  };
};

const listCertificateRequests = async ({ status, page, limit }) => {
  const pagination = getPaginationParams({ page, limit });

  const where = {
    status: status || undefined,
  };

  const [docs, total] = await Promise.all([
    prisma.certificateRequest.findMany({
      where,
      include: {
        client: true,
        user: {
          include: {
            role: true,
          },
        },
        certificate: true,
      },
      orderBy: { id: "desc" },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.certificateRequest.count({ where }),
  ]);

  return buildPaginationResult({
    docs: docs.map(formatCertificateRequestResponse),
    total,
    page: pagination.page,
    limit: pagination.limit,
  });
};

const getCertificateRequestById = async (id) => {
  const request = await prisma.certificateRequest.findUnique({
    where: { id },
    include: {
      client: true,
      user: {
        include: {
          role: true,
        },
      },
      certificate: true,
    },
  });

  if (!request) {
    throw new HttpError(404, "Solicitud de certificado no encontrada");
  }

  return formatCertificateRequestResponse(request);
};

const createCertificateRequest = async (payload, userId) => {
  const clientSnapshot = payload.client || {};
  const documentNumber = String(clientSnapshot.documentNumber || "").trim();
  const fullName = String(clientSnapshot.fullName || "").trim();

  if (!documentNumber || !fullName) {
    throw new HttpError(400, "client.fullName y client.documentNumber son obligatorios");
  }

  const creator = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
      })
    : null;

  if (userId && !creator) {
    throw new HttpError(401, "El usuario autenticado no existe o ya no esta disponible");
  }

  const sequenceData = await nextRequestCode();
  const isComunero = typeof payload.isComunero === "boolean" ? payload.isComunero : true;
  const clientType = isComunero ? "Comunero" : "Tercero";

  const client = await prisma.client.upsert({
    where: { documentNumber },
    update: {
      fullName,
      address: clientSnapshot.address || undefined,
      clientType,
    },
    create: {
      fullName,
      documentNumber,
      address: clientSnapshot.address || null,
      phone: null,
      clientType,
    },
  });

  const partnerClient = payload.partnerClient || {};

  const request = await prisma.certificateRequest.create({
    data: {
      code: sequenceData.code,
      requestNumber: sequenceData.requestNumber,
      clientId: client.id,
      userId: creator?.id || null,
      description: payload.requestDescription || null,
      isComunero,
      destination: payload.destination || null,
      requestDescription: payload.requestDescription || null,
      sectorLocation: payload.sectorLocation || null,
      clientSearchType: normalizeValueToken(clientSnapshot.searchType || "Reniec") || "Reniec",
      clientFullName: clientSnapshot.fullName || client.fullName,
      clientDocumentNumber: clientSnapshot.documentNumber || client.documentNumber,
      clientAddress: clientSnapshot.address || client.address || "",
      partnerSearchType: normalizeValueToken(partnerClient.searchType || "") || null,
      partnerFullName: partnerClient.fullName || null,
      partnerDocumentNumber: partnerClient.documentNumber || null,
      partnerAddress: partnerClient.address || null,
      certificateTypes: normalizeCertificateTypes(payload.certificateTypes || []),
      exposure: payload.exposure || null,
      attachments: normalizeAttachments(payload.attachments || []),
      createdByDni: creator?.dni || null,
      createdByRole: creator?.role?.name ? normalizeValueToken(creator.role.name) : null,
    },
    include: {
      client: true,
      user: {
        include: {
          role: true,
        },
      },
    },
  });

  return formatCertificateRequestResponse(request);
};

const updateCertificateRequest = async (id, payload) => {
  const current = await prisma.certificateRequest.findUnique({
    where: { id },
    include: {
      client: true,
      user: {
        include: { role: true },
      },
    },
  });

  if (!current) {
    throw new HttpError(404, "Solicitud de certificado no encontrada");
  }

  const clientSnapshot = payload.client || {};
  const partnerClient = payload.partnerClient || {};

  const updated = await prisma.certificateRequest.update({
    where: { id },
    data: {
      description: payload.requestDescription || payload.description,
      isComunero: typeof payload.isComunero === "boolean" ? payload.isComunero : undefined,
      destination: payload.destination,
      requestDescription: payload.requestDescription,
      sectorLocation: payload.sectorLocation,
      clientSearchType: clientSnapshot.searchType ? normalizeValueToken(clientSnapshot.searchType) : undefined,
      clientFullName: clientSnapshot.fullName,
      clientDocumentNumber: clientSnapshot.documentNumber,
      clientAddress: clientSnapshot.address,
      partnerSearchType: partnerClient.searchType ? normalizeValueToken(partnerClient.searchType) : undefined,
      partnerFullName: partnerClient.fullName,
      partnerDocumentNumber: partnerClient.documentNumber,
      partnerAddress: partnerClient.address,
      certificateTypes: payload.certificateTypes ? normalizeCertificateTypes(payload.certificateTypes) : undefined,
      exposure: payload.exposure,
      attachments: payload.attachments ? normalizeAttachments(payload.attachments) : undefined,
      status: payload.status,
    },
    include: {
      client: true,
      user: {
        include: {
          role: true,
        },
      },
      certificate: true,
    },
  });

  return formatCertificateRequestResponse(updated);
};

const deleteCertificateRequest = async (id) => {
  const request = await prisma.certificateRequest.findUnique({ where: { id } });
  if (!request) {
    throw new HttpError(404, "Solicitud de certificado no encontrada");
  }
  await prisma.certificateRequest.delete({ where: { id } });
};

module.exports = {
  listCertificateRequests,
  getCertificateRequestById,
  createCertificateRequest,
  updateCertificateRequest,
  deleteCertificateRequest,
};
