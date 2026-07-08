const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const { makeDeletionPreview } = require("../../../utils/deletion-preview");
const {
  buildAssemblyRequestCode,
  formatAssemblyRecordRequestResponse,
  normalizeAssemblyRecordAttachments,
  normalizeAssemblyRecordRequestStatus,
} = require("../utils/assembly-record-requests.utils");

const buildAssemblyRecordRequestData = (payload = {}) => {
  const data = {};

  if (payload.description !== undefined) {
    data.description = String(payload.description || "").trim() || null;
  }

  if (payload.buyerFullName !== undefined) {
    data.buyerFullName = String(payload.buyerFullName || "").trim() || null;
  }

  if (payload.sellerFullName !== undefined) {
    data.sellerFullName = String(payload.sellerFullName || "").trim() || null;
  }

  if (payload.sectorLocation !== undefined) {
    data.sectorLocation = String(payload.sectorLocation || "").trim() || null;
  }

  if (payload.terrainType !== undefined) {
    data.terrainType = String(payload.terrainType || "").trim() || null;
  }

  if (payload.awardDate !== undefined) {
    const date = payload.awardDate ? new Date(payload.awardDate) : null;
    data.awardDate = date && !Number.isNaN(date.getTime()) ? date : null;
  }

  if (payload.possessionTime !== undefined) {
    data.possessionTime = String(payload.possessionTime || "").trim() || null;
  }

  if (payload.email !== undefined) {
    data.email = String(payload.email || "").trim() || null;
  }

  if (payload.phone !== undefined) {
    data.phone = String(payload.phone || "").trim() || null;
  }

  if (payload.attachments !== undefined) {
    data.attachments = normalizeAssemblyRecordAttachments(payload.attachments, payload.legacyPayload);
  }

  if (payload.legacyPayload !== undefined) {
    data.legacyPayload = payload.legacyPayload;
  }

  if (payload.status !== undefined) {
    const normalized = normalizeAssemblyRecordRequestStatus(payload.status);
    if (!normalized) {
      throw new HttpError(400, "Estado de solicitud de acta invalido");
    }
    data.status = normalized;
  }

  return data;
};

const nextCode = async () => {
  const lastRequest = await prisma.assemblyRecordRequest.findFirst({
    orderBy: { id: "desc" },
    select: { id: true },
  });

  return buildAssemblyRequestCode((lastRequest?.id || 0) + 1);
};

const listAssemblyRecordRequests = async ({ page, limit, search }) => {
  const pagination = getPaginationParams({ page, limit });

  const where = {};
  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { buyerFullName: { contains: search, mode: "insensitive" } },
      { sellerFullName: { contains: search, mode: "insensitive" } },
      { sectorLocation: { contains: search, mode: "insensitive" } },
      { terrainType: { contains: search, mode: "insensitive" } },
      {
        client: {
          is: {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { documentNumber: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      },
      {
        certificate: {
          is: {
            certificateNumber: { contains: search, mode: "insensitive" },
          },
        },
      },
    ];
  }

  const [docs, total] = await Promise.all([
    prisma.assemblyRecordRequest.findMany({
      where,
      include: {
        client: { include: { commoner: true } },
        certificate: { include: { sector: true, terrainType: true } },
        user: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.assemblyRecordRequest.count({ where }),
  ]);

  return buildPaginationResult({
    docs: docs.map(formatAssemblyRecordRequestResponse),
    total,
    page: pagination.page,
    limit: pagination.limit,
  });
};

const getAssemblyRecordRequestById = async (id) => {
  const request = await prisma.assemblyRecordRequest.findUnique({
    where: { id },
    include: {
      client: { include: { commoner: true } },
      certificate: { include: { sector: true, terrainType: true } },
      user: true,
    },
  });

  if (!request) {
    throw new HttpError(404, "Solicitud de acta no encontrada");
  }

  return formatAssemblyRecordRequestResponse(request);
};

const getAssemblyRecordRequestDeletePreview = async (id) => {
  const request = await prisma.assemblyRecordRequest.findUnique({
    where: { id },
    select: { code: true },
  });

  if (!request) {
    throw new HttpError(404, "Solicitud de acta no encontrada");
  }

  return makeDeletionPreview({
    entityLabel: "solicitud de acta",
    itemName: request.code,
  });
};

const getAssemblyRecordRequestByCode = async (code) => {
  const request = await prisma.assemblyRecordRequest.findUnique({
    where: { code },
    include: {
      client: { include: { commoner: true } },
      certificate: { include: { sector: true, terrainType: true } },
      user: true,
    },
  });

  if (!request) {
    throw new HttpError(404, "Solicitud de acta no encontrada");
  }

  return formatAssemblyRecordRequestResponse(request);
};

const createAssemblyRecordRequest = async (payload, userId) => {
  const certificateId = Number(payload.certificateId);
  if (!Number.isFinite(certificateId)) {
    throw new HttpError(400, "certificateId inválido");
  }

  const certificate = await prisma.certificate.findUnique({ where: { id: certificateId } });
  if (!certificate) {
    throw new HttpError(400, "Debe existir un certificado previo para crear la solicitud");
  }

  const clientId = certificate.clientId;
  if (payload.clientId !== undefined && Number(payload.clientId) !== clientId) {
    throw new HttpError(400, "El cliente no coincide con el certificado seleccionado");
  }

  const code = await nextCode();

  const data = buildAssemblyRecordRequestData(payload);

  return prisma.assemblyRecordRequest.create({
    data: {
      code,
      clientId,
      certificateId,
      userId,
      ...data,
    },
    include: {
      client: { include: { commoner: true } },
      certificate: { include: { sector: true, terrainType: true } },
      user: true,
    },
  }).then(formatAssemblyRecordRequestResponse);
};

const updateAssemblyRecordRequest = async (id, payload) => {
  const existing = await prisma.assemblyRecordRequest.findUnique({
    where: { id },
    include: {
      client: { include: { commoner: true } },
      certificate: { include: { sector: true, terrainType: true } },
      user: true,
    },
  });

  if (!existing) {
    throw new HttpError(404, "Solicitud de acta no encontrada");
  }

  const certificateId = payload.certificateId !== undefined ? Number(payload.certificateId) : existing.certificateId;
  if (!Number.isFinite(certificateId)) {
    throw new HttpError(400, "certificateId inválido");
  }

  const certificate = await prisma.certificate.findUnique({ where: { id: certificateId } });
  if (!certificate) {
    throw new HttpError(400, "Debe existir un certificado previo para actualizar la solicitud");
  }

  const clientId = certificate.clientId;
  if (payload.clientId !== undefined && Number(payload.clientId) !== clientId) {
    throw new HttpError(400, "El cliente no coincide con el certificado seleccionado");
  }

  const data = buildAssemblyRecordRequestData(payload);

  return prisma.assemblyRecordRequest.update({
    where: { id },
    data: {
      clientId,
      certificateId,
      ...data,
    },
    include: {
      client: { include: { commoner: true } },
      certificate: { include: { sector: true, terrainType: true } },
      user: true,
    },
  }).then(formatAssemblyRecordRequestResponse);
};

const deleteAssemblyRecordRequest = async (id) => {
  await getAssemblyRecordRequestDeletePreview(id);
  await prisma.assemblyRecordRequest.delete({ where: { id } });
};

module.exports = {
  listAssemblyRecordRequests,
  getAssemblyRecordRequestById,
  getAssemblyRecordRequestByCode,
  createAssemblyRecordRequest,
  updateAssemblyRecordRequest,
  deleteAssemblyRecordRequest,
  getAssemblyRecordRequestDeletePreview,
};
