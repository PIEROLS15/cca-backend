const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const {
  buildRequestNumber,
  normalizeCertificateTypes,
  normalizeAttachments,
  formatCertificateRequestResponse,
} = require("../utils/certificate-requests.utils");
const clientsService = require("../../clients/services/clients.service");

const requestIncludes = {
  client: true,
  user: { include: { role: true } },
  partner: true,
};

const nextRequestNumber = async () => {
  const lastRequest = await prisma.certificateRequest.findFirst({
    orderBy: { id: "desc" },
    select: { id: true },
  });

  const nextSequence = (lastRequest?.id || 0) + 1;
  return buildRequestNumber(nextSequence);
};

const listCertificateRequests = async ({ status, page, limit }) => {
  const pagination = getPaginationParams({ page, limit });

  const where = {
    status: status || undefined,
  };

  const [docs, total] = await Promise.all([
    prisma.certificateRequest.findMany({
      where,
      include: requestIncludes,
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

const getCertificateRequestById = async (identifier) => {
  const id = Number(identifier);
  const isNumeric = !Number.isNaN(id) && String(id) === identifier.trim();

  let request = null;

  if (isNumeric) {
    request = await prisma.certificateRequest.findUnique({
      where: { id },
      include: requestIncludes,
    });
  }

  if (!request) {
    request = await prisma.certificateRequest.findFirst({
      where: { requestNumber: { startsWith: identifier } },
      include: requestIncludes,
    });
  }

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

  const requestNumber = await nextRequestNumber();
  const isComunero = typeof payload.isComunero === "boolean" ? payload.isComunero : true;
  const clientType = isComunero ? "Comunero" : "Tercero";

  const client = await clientsService.upsertClientByDocument(documentNumber, {
    fullName,
    address: clientSnapshot.address || null,
    phone: null,
    clientType,
  });

  let partnerId = null;
  const partnerClient = payload.partnerClient || {};

  if (partnerClient.fullName || partnerClient.documentNumber) {
    const partnerDoc = String(partnerClient.documentNumber || "").trim();
    const partnerName = String(partnerClient.fullName || "").trim();

    if (partnerDoc && partnerName) {
      const partner = await clientsService.upsertClientByDocument(partnerDoc, {
        fullName: partnerName,
        address: partnerClient.address || null,
        phone: null,
        clientType: "Tercero",
      });
      partnerId = partner.id;
    }
  }

  const request = await prisma.certificateRequest.create({
    data: {
      requestNumber,
      clientId: client.id,
      userId: creator?.id || null,
      partnerId,
      description: payload.requestDescription || null,
      destination: payload.destination || null,
      requestDescription: payload.requestDescription || null,
      sectorLocation: payload.sectorLocation || null,
      certificateTypes: normalizeCertificateTypes(payload.certificateTypes || []),
      exposure: payload.exposure || null,
      attachments: normalizeAttachments(payload.attachments || []),
    },
    include: requestIncludes,
  });

  return formatCertificateRequestResponse(request);
};

const updateCertificateRequest = async (id, payload) => {
  const current = await prisma.certificateRequest.findUnique({
    where: { id },
    include: requestIncludes,
  });

  if (!current) {
    throw new HttpError(404, "Solicitud de certificado no encontrada");
  }

  const data = {};

  if (payload.client !== undefined) {
    const clientSnapshot = payload.client;
    const doc = String(clientSnapshot.documentNumber || "").trim();
    const name = String(clientSnapshot.fullName || "").trim();

    if (doc && name) {
      const isComunero = typeof payload.isComunero === "boolean" ? payload.isComunero : current.client?.clientType === "Comunero";
      const clientType = isComunero ? "Comunero" : "Tercero";

      const updatedClient = await clientsService.upsertClientByDocument(doc, {
        fullName: name,
        address: clientSnapshot.address || null,
        phone: null,
        clientType,
      });
      data.clientId = updatedClient.id;
    }
  }

  const partnerClient = payload.partnerClient || {};

  if (Object.keys(payload.partnerClient || {}).length > 0) {
    const partnerDoc = String(partnerClient.documentNumber || "").trim();
    const partnerName = String(partnerClient.fullName || "").trim();

    if (partnerDoc && partnerName) {
      const partner = await clientsService.upsertClientByDocument(partnerDoc, {
        fullName: partnerName,
        address: partnerClient.address || null,
        phone: null,
        clientType: "Tercero",
      });
      data.partnerId = partner.id;
    } else {
      data.partnerId = null;
    }
  }

  if (payload.description !== undefined) data.description = payload.description;
  if (payload.requestDescription !== undefined) data.requestDescription = payload.requestDescription;
  if (payload.destination !== undefined) data.destination = payload.destination;
  if (payload.sectorLocation !== undefined) data.sectorLocation = payload.sectorLocation;
  if (payload.exposure !== undefined) data.exposure = payload.exposure;
  if (payload.status !== undefined) data.status = payload.status;
  if (payload.certificateTypes !== undefined) data.certificateTypes = normalizeCertificateTypes(payload.certificateTypes);
  if (payload.attachments !== undefined) data.attachments = normalizeAttachments(payload.attachments);

  const updated = await prisma.certificateRequest.update({
    where: { id },
    data,
    include: requestIncludes,
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
