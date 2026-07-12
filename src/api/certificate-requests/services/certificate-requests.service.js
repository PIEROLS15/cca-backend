const { Prisma } = require("@prisma/client");
const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const { makeDeletionPreview, makeImpactItem } = require("../../../utils/deletion-preview");
const {
  buildRequestNumber,
  normalizeCertificateTypes,
  normalizeAttachments,
  formatCertificateRequestResponse,
  normalizeCertificateRequestStatus,
} = require("../utils/certificate-requests.utils");
const clientsService = require("../../clients/services/clients.service");
const {
  DOCUMENT_TYPES,
  recordDocumentStatusHistory,
  getLatestObservationNotes,
  getCurrentCanonicalStatusRank,
  clearLaterDocumentStatusHistory,
  getCanonicalStatusRank,
} = require("../../../utils/document-status-history.utils");

const requestIncludes = {
  client: { include: { commoner: true } },
  user: { include: { role: true } },
  partner: { include: { commoner: true } },
};

const enrichRequestsWithStatusNotes = async (docs) => {
  const notes = await getLatestObservationNotes(prisma, DOCUMENT_TYPES.CERTIFICATE_REQUEST, docs.map((doc) => doc.id));

  return docs.map((doc) => ({
    ...doc,
    statusNote: doc.status === "Observado" ? notes.get(doc.id) || null : null,
  }));
};

const REQUEST_NUMBER_COUNTER_KEY = "certificate-request";
const MAX_REQUEST_NUMBER_RETRIES = 3;

const isRequestNumberRaceError = (error) => {
  if (error?.code === "P2034") {
    return true;
  }

  return error?.code === "P2002"
    && Array.isArray(error?.meta?.target)
    && (error.meta.target.includes("requestNumber") || error.meta.target.includes("key"));
};

const runRequestNumberWriteTransaction = async (handler) => {
  let attempt = 0;

  while (attempt < MAX_REQUEST_NUMBER_RETRIES) {
    try {
      return await prisma.$transaction(
        async (tx) => handler(tx),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      attempt += 1;

      if (!isRequestNumberRaceError(error) || attempt >= MAX_REQUEST_NUMBER_RETRIES) {
        throw error;
      }
    }
  }
};

const reserveNextRequestNumber = async (tx) => {
  await tx.requestNumberCounter.upsert({
    where: { key: REQUEST_NUMBER_COUNTER_KEY },
    create: { key: REQUEST_NUMBER_COUNTER_KEY, value: 0 },
    update: {},
  });

  const latestRows = await tx.$queryRaw`
    SELECT COALESCE(
      MAX(
        NULLIF(
          regexp_replace(split_part("requestNumber", '-', 1), '[^0-9]', '', 'g'),
          ''
        )::integer
      ),
      0
    ) AS "latestSequence"
    FROM "CertificateRequest"
  `;

  const latestSequence = Number(latestRows?.[0]?.latestSequence || 0);

  const reservedRows = await tx.$queryRaw`
    UPDATE "RequestNumberCounter"
    SET "value" = GREATEST("value", ${latestSequence}) + 1,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "key" = ${REQUEST_NUMBER_COUNTER_KEY}
    RETURNING "value"
  `;

  const nextSequence = Number(reservedRows?.[0]?.value);

  if (!Number.isInteger(nextSequence) || nextSequence <= 0) {
    throw new Error("No se pudo reservar el siguiente correlativo de solicitud");
  }

  return buildRequestNumber(nextSequence);
};

const listCertificateRequests = async ({ page, limit, search }) => {
  const pagination = getPaginationParams({ page, limit });

  const where = {};
  if (search) {
    where.OR = [
      { requestNumber: { contains: search, mode: "insensitive" } },
      {
        client: {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { documentNumber: { contains: search, mode: "insensitive" } },
            { clientCode: { contains: search, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const [docs, total] = await Promise.all([
    prisma.certificateRequest.findMany({
      where,
      include: requestIncludes,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.certificateRequest.count({ where }),
  ]);

  const enrichedDocs = await enrichRequestsWithStatusNotes(docs);

  return buildPaginationResult({
    docs: enrichedDocs.map(formatCertificateRequestResponse),
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
      where: { requestNumber: identifier },
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

  const [enriched] = await enrichRequestsWithStatusNotes([request]);
  return formatCertificateRequestResponse(enriched);
};

const getCertificateRequestDeletePreview = async (id) => {
  const request = await prisma.certificateRequest.findUnique({
    where: { id },
    select: {
      requestNumber: true,
      _count: {
        select: {
          certificates: true,
        },
      },
    },
  });

  if (!request) {
    throw new HttpError(404, "Solicitud de certificado no encontrada");
  }

  return makeDeletionPreview({
    entityLabel: "solicitud de certificado",
    itemName: request.requestNumber,
    willSetNull: request._count.certificates > 0
      ? [makeImpactItem({ label: "Certificados vinculados", count: request._count.certificates })]
      : [],
  });
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

  const isComunero = typeof payload.isComunero === "boolean" ? payload.isComunero : true;

  const client = await clientsService.upsertClientByDocument(documentNumber, {
    fullName,
    address: clientSnapshot.address || null,
    phone: null,
    isComunero,
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
        isComunero: false,
      });
      partnerId = partner.id;
    }
  }

  const request = await runRequestNumberWriteTransaction(async (tx) => {
    const requestNumber = await reserveNextRequestNumber(tx);

    const request = await tx.certificateRequest.create({
      data: {
        requestNumber,
        clientId: client.id,
        userId: creator?.id || null,
        partnerId,
        status: "Recepcionado",
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

    await recordDocumentStatusHistory(tx, {
      documentType: DOCUMENT_TYPES.CERTIFICATE_REQUEST,
      documentId: request.id,
      status: request.status,
      changedByUserId: creator?.id || null,
      changedAt: request.createdAt,
    });

    return request;
  });

  const [enriched] = await enrichRequestsWithStatusNotes([request]);
  return formatCertificateRequestResponse(enriched);
};

const updateCertificateRequest = async (id, payload, changedByUserId = null) => {
  const current = await prisma.certificateRequest.findUnique({
    where: { id },
    include: requestIncludes,
  });

  if (!current) {
    throw new HttpError(404, "Solicitud de certificado no encontrada");
  }

  const data = {};
  let nextStatus = null;

  if (payload.client !== undefined) {
    const clientSnapshot = payload.client;
    const doc = String(clientSnapshot.documentNumber || "").trim();
    const name = String(clientSnapshot.fullName || "").trim();

    if (doc && name) {
      const isComunero = typeof payload.isComunero === "boolean" ? payload.isComunero : current.client?.commoner != null;

      const updatedClient = await clientsService.upsertClientByDocument(doc, {
        fullName: name,
        address: clientSnapshot.address || null,
        phone: null,
        isComunero,
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
        isComunero: false,
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
  if (payload.certificateTypes !== undefined) data.certificateTypes = normalizeCertificateTypes(payload.certificateTypes);
  if (payload.attachments !== undefined) data.attachments = normalizeAttachments(payload.attachments);
  if (payload.status !== undefined) {
    const normalized = normalizeCertificateRequestStatus(payload.status);
    if (!normalized) {
      throw new HttpError(400, "Estado de solicitud de certificado invalido");
    }
    if (normalized === "Observado" && !String(payload.note || "").trim()) {
      throw new HttpError(400, "La razón es obligatoria cuando el estado es Observado");
    }
    data.status = normalized;
    nextStatus = normalized;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.certificateRequest.update({
      where: { id },
      data,
      include: requestIncludes,
    });

    const historyRows = await tx.documentStatusHistory.findMany({
      where: {
        documentType: DOCUMENT_TYPES.CERTIFICATE_REQUEST,
        documentId: id,
      },
      orderBy: [{ changedAt: "asc" }, { id: "asc" }],
      select: { id: true, changedAt: true, status: true },
    });

    if (nextStatus && nextStatus !== current.status) {
      const currentRank = getCurrentCanonicalStatusRank(historyRows, current.status);
      const nextRank = getCanonicalStatusRank(nextStatus);

      if (nextRank >= 0 && currentRank >= 0 && nextRank < currentRank) {
        await clearLaterDocumentStatusHistory(tx, {
          documentType: DOCUMENT_TYPES.CERTIFICATE_REQUEST,
          documentId: id,
          targetStatus: nextStatus,
          historyRows,
        });
      } else {
        await recordDocumentStatusHistory(tx, {
          documentType: DOCUMENT_TYPES.CERTIFICATE_REQUEST,
          documentId: id,
          status: nextStatus,
          changedByUserId,
          note: nextStatus === "Observado" ? String(payload.note || "").trim() : null,
        });
      }
    }

    return result;
  });

  const [enriched] = await enrichRequestsWithStatusNotes([updated]);
  return formatCertificateRequestResponse(enriched);
};

const deleteCertificateRequest = async (id) => {
  await getCertificateRequestDeletePreview(id);
  await prisma.certificateRequest.delete({ where: { id } });
};

module.exports = {
  listCertificateRequests,
  getCertificateRequestById,
  createCertificateRequest,
  updateCertificateRequest,
  deleteCertificateRequest,
  getCertificateRequestDeletePreview,
};
