const { Prisma } = require("@prisma/client");
const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const { formatCertificateSequence } = require("../../../utils/certificate-range.utils");
const {
  normalizeCertificateStatus,
  normalizeTerrainMeasurementMode,
  deriveTerrainMeasurementMode,
  formatCertificateResponse,
  buildCertificateFilters,
} = require("../utils/certificates.utils");
const { makeDeletionPreview, makeImpactItem } = require("../../../utils/deletion-preview");
const {
  buildCertificateVerificationPayload,
} = require("../utils/certificate-verification.utils");
const { DOCUMENT_TYPES, recordDocumentStatusHistory } = require("../../../utils/document-status-history.utils");

const MAX_ADDITIONAL_NOTES_LENGTH = 120;

const certificateInclude = {
  client: true,
  partner: true,
  sector: true,
  terrainType: { include: { config: true } },
  user: { include: { role: true } },
  certificateRequest: { select: { id: true, requestNumber: true } },
  owners: {
    include: { client: true },
    orderBy: { order: "asc" },
  },
};

const normalizeOwnerEntries = (owners = []) => owners
  .map((owner) => ({
    id: Number(owner?.id) || null,
    fullName: String(owner?.fullName || "").trim(),
    documentNumber: String(owner?.documentNumber || "").replace(/\D/g, "").trim(),
  }))
  .filter((owner) => owner.id || owner.documentNumber || owner.fullName);

const normalizeComparableName = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const normalizeDocumentNumber = (value) => String(value || "").replace(/\D/g, "").trim();

const normalizeAdditionalNotes = (value) => String(value || "").trim();

const syncCertificateOwners = async (tx, certificateId, ownerIds) => {
  await tx.certificateOwner.deleteMany({ where: { certificateId } });

  if (ownerIds.length === 0) return;

  await tx.certificateOwner.createMany({
    data: ownerIds.map((clientId, index) => ({
      certificateId,
      clientId,
      order: index + 1,
      source: index === 0 ? "primary" : index === 1 ? "partner" : `owner-${index + 1}`,
    })),
  });
};

const MAX_CERTIFICATE_WRITE_RETRIES = 3;

const runCertificateWriteTransaction = async (handler) => {
  let attempt = 0;

  while (attempt < MAX_CERTIFICATE_WRITE_RETRIES) {
    try {
      return await prisma.$transaction(
        async (tx) => handler(tx),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      attempt += 1;

      if (error?.code !== "P2034" || attempt >= MAX_CERTIFICATE_WRITE_RETRIES) {
        throw error;
      }
    }
  }
};

const reserveCertificateNumberForUser = async (tx, userId) => {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      certificateRangeStart: true,
      certificateRangeEnd: true,
      lastCertificate: true,
    },
  });

  if (!user) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  if (user.certificateRangeStart == null || user.certificateRangeEnd == null) {
    throw new HttpError(409, "El usuario no tiene un limite de certificados asignado");
  }

  const currentLast = user.lastCertificate == null
    ? user.certificateRangeStart - 1
    : Math.max(Number(user.lastCertificate), user.certificateRangeStart - 1);
  const nextSequence = currentLast + 1;

  if (nextSequence < user.certificateRangeStart || nextSequence > user.certificateRangeEnd) {
    throw new HttpError(409, "El usuario ya alcanzo su limite de certificados");
  }

  await tx.user.update({
    where: { id: userId },
    data: { lastCertificate: nextSequence },
  });

  return nextSequence;
};

const resolveOwnerClients = async (tx, owners = []) => {
  const ownerEntries = normalizeOwnerEntries(owners);

  if (ownerEntries.length === 0) {
    throw new HttpError(400, "Debe proporcionar al menos un propietario");
  }

  const resolved = [];
  const seen = new Set();

  for (const owner of ownerEntries) {
    const documentNumber = normalizeDocumentNumber(owner.documentNumber);
    const fullName = String(owner.fullName || "").trim();

    if (!documentNumber) {
      throw new HttpError(400, "Cada dueño debe tener DNI");
    }

    if (!fullName) {
      throw new HttpError(400, "Cada dueño debe tener nombres y DNI");
    }

    let client = await tx.client.findUnique({
      where: { documentNumber },
      select: { id: true, fullName: true, documentNumber: true },
    });

    if (!client && owner.id) {
      client = await tx.client.findUnique({
        where: { id: owner.id },
        select: { id: true, fullName: true, documentNumber: true },
      });
    }

    if (client) {
      if (normalizeComparableName(client.fullName) !== normalizeComparableName(fullName)) {
        client = await tx.client.update({
          where: { id: client.id },
          data: { fullName },
          select: { id: true, fullName: true, documentNumber: true },
        });
      }
    } else {
      client = await tx.client.create({
        data: {
          fullName,
          documentNumber,
          address: null,
          phone: null,
        },
        select: { id: true, fullName: true, documentNumber: true },
      });
    }

    if (!seen.has(client.id)) {
      seen.add(client.id);
      resolved.push(client);
    }
  }

  return resolved;
};

const listCertificates = async (query) => {
  const pagination = getPaginationParams(query);
  const where = buildCertificateFilters(query);

  const [docs, total] = await Promise.all([
    prisma.certificate.findMany({
      where,
      include: certificateInclude,
      orderBy: [
        { createdAt: "desc" },
        { certificateNumber: "desc" },
      ],
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.certificate.count({ where }),
  ]);

  return buildPaginationResult({
    docs: docs.map(formatCertificateResponse),
    total,
    page: pagination.page,
    limit: pagination.limit,
  });
};

const getCertificateById = async (id) => {
  const certificate = await prisma.certificate.findUnique({
    where: { id },
    include: certificateInclude,
  });

  if (!certificate) {
    throw new HttpError(404, "Certificado no encontrado");
  }

  return formatCertificateResponse(certificate);
};

const createCertificate = async (payload, userId) => {
  if (!userId) {
    throw new HttpError(401, "Usuario autenticado requerido");
  }

  const certificate = await runCertificateWriteTransaction(async (tx) => {
    const ownerClients = await resolveOwnerClients(tx, payload.owners || []);
    const ownerIds = ownerClients.map((owner) => owner.id);

    const linkedRequest = payload.certificateRequestId !== undefined && payload.certificateRequestId !== null
      ? await tx.certificateRequest.findUnique({
          where: { id: Number(payload.certificateRequestId) },
          select: { id: true, clientId: true },
        })
      : null;

    if (payload.certificateRequestId !== undefined && payload.certificateRequestId !== null) {
      if (!linkedRequest) {
        throw new HttpError(404, "Solicitud de certificado no encontrada");
      }
      if (linkedRequest.clientId !== ownerIds[0]) {
        throw new HttpError(400, "La solicitud no corresponde al titular principal");
      }
    }

    const terrainTypeId = Number(payload.terrain?.terrainType?.id);
    if (!terrainTypeId) {
      throw new HttpError(400, "terrain.terrainType.id es obligatorio");
    }
    if (!(await tx.terrainType.findUnique({ where: { id: terrainTypeId } }))) {
      throw new HttpError(404, "Tipo de terreno no encontrado");
    }

    const sectorId = Number(payload.location?.sectors?.id);
    if (!sectorId) {
      throw new HttpError(400, "location.sectors.id es obligatorio");
    }

    const additionalNotes = normalizeAdditionalNotes(payload.additionalNotes);
    if (additionalNotes.length > MAX_ADDITIONAL_NOTES_LENGTH) {
      throw new HttpError(400, `Las notas adicionales no pueden superar ${MAX_ADDITIONAL_NOTES_LENGTH} caracteres`);
    }
    if (!(await tx.sector.findUnique({ where: { id: sectorId } }))) {
      throw new HttpError(404, "Sector no encontrado");
    }

    const certificateNumber = formatCertificateSequence(await reserveCertificateNumberForUser(tx, userId));
    if (!certificateNumber) {
      throw new Error("No se pudo generar el numero de certificado");
    }

    const statusNormalized = normalizeCertificateStatus(payload.status) || "PorFirmar";
    const measurementModeUsed = normalizeTerrainMeasurementMode(payload.terrain?.measurementModeUsed)
      || deriveTerrainMeasurementMode(payload.terrain);

    const created = await tx.certificate.create({
      data: {
        certificateNumber,
        requestNumber: payload.requestNumber || "",
        certificateRequestId: linkedRequest?.id ?? null,
        clientId: ownerIds[0],
        partnerId: ownerIds[1] || null,
        sectorId,
        terrainTypeId,
        userId,
        width: payload.terrain?.width ?? null,
        length: payload.terrain?.length ?? null,
        totalArea: payload.terrain?.totalArea ?? null,
        area: payload.terrain?.area ?? null,
        perimeter: payload.terrain?.perimeter ?? null,
        additionalWidth: payload.terrain?.additionalWidth ?? null,
        additionalLength: payload.terrain?.additionalLength ?? null,
        measurementModeUsed,
        mz: payload.location?.mz || null,
        lot: payload.location?.lot || null,
        north: payload.borders?.north || null,
        south: payload.borders?.south || null,
        east: payload.borders?.east || null,
        west: payload.borders?.west || null,
        additionalNotes: additionalNotes || null,
        status: statusNormalized,
      },
      select: { id: true, createdAt: true },
    });

    await syncCertificateOwners(tx, created.id, ownerIds);

    await recordDocumentStatusHistory(tx, {
      documentType: DOCUMENT_TYPES.CERTIFICATE,
      documentId: created.id,
      status: statusNormalized,
      changedByUserId: userId,
      changedAt: created.createdAt,
    });

    const withOwners = await tx.certificate.findUnique({
      where: { id: created.id },
      include: certificateInclude,
    });

    return tx.certificate.findUnique({
      where: { id: created.id },
      include: certificateInclude,
    });
  });

  return formatCertificateResponse(certificate);
};

const getCertificateDeletePreview = async (id) => {
  const certificate = await prisma.certificate.findUnique({
    where: { id },
    select: {
      certificateNumber: true,
      _count: {
        select: {
          owners: true,
          assemblyRecordRequests: true,
        },
      },
    },
  });

  if (!certificate) {
    throw new HttpError(404, "Certificado no encontrado");
  }

  return makeDeletionPreview({
    entityLabel: "certificado",
    itemName: certificate.certificateNumber,
    willBlock: certificate._count.assemblyRecordRequests > 0
      ? [makeImpactItem({ label: "Solicitudes de acta vinculadas", count: certificate._count.assemblyRecordRequests })]
      : [],
  });
};

const updateCertificate = async (id, payload, changedByUserId = null) => {
  const existing = await prisma.certificate.findUnique({
    where: { id },
    include: certificateInclude,
  });

  if (!existing) {
    throw new HttpError(404, "Certificado no encontrado");
  }

  const data = {};
  const certificate = await prisma.$transaction(async (tx) => {
    let ownerIdsToSync = null;
    let nextStatus = null;

    if (payload.owners) {
      ownerIdsToSync = (await resolveOwnerClients(tx, payload.owners)).map((owner) => owner.id);
      data.clientId = ownerIdsToSync[0];
      data.partnerId = ownerIdsToSync[1] || null;
    }

    const effectiveClientId = data.clientId || existing.clientId;

    if (payload.certificateRequestId !== undefined) {
      const linkedRequest = payload.certificateRequestId === null
        ? null
        : await tx.certificateRequest.findUnique({
            where: { id: Number(payload.certificateRequestId) },
            select: { id: true, clientId: true },
          });

      if (payload.certificateRequestId !== null && !linkedRequest) {
        throw new HttpError(404, "Solicitud de certificado no encontrada");
      }

      if (linkedRequest && effectiveClientId && linkedRequest.clientId !== effectiveClientId) {
        throw new HttpError(400, "La solicitud no corresponde al titular principal");
      }

      data.certificateRequestId = linkedRequest?.id ?? null;
    } else if (ownerIdsToSync && existing.certificateRequestId) {
      const linkedRequest = await tx.certificateRequest.findUnique({
        where: { id: existing.certificateRequestId },
        select: { id: true, clientId: true },
      });

      if (linkedRequest && linkedRequest.clientId !== effectiveClientId) {
        throw new HttpError(400, "La solicitud no corresponde al titular principal");
      }
    }

    if (payload.terrain !== undefined) {
      if (payload.terrain?.terrainType?.id !== undefined) {
        const ttId = Number(payload.terrain.terrainType.id);
        if (ttId) {
          const tt = await tx.terrainType.findUnique({ where: { id: ttId } });
          if (!tt) throw new HttpError(404, "Tipo de terreno no encontrado");
          data.terrainTypeId = ttId;
        } else {
          throw new HttpError(400, "terrain.terrainType.id es obligatorio");
        }
      }
      if ("width" in payload.terrain) data.width = payload.terrain.width ?? null;
      if ("length" in payload.terrain) data.length = payload.terrain.length ?? null;
      if ("totalArea" in payload.terrain) data.totalArea = payload.terrain.totalArea ?? null;
      if ("area" in payload.terrain) data.area = payload.terrain.area ?? null;
      if ("perimeter" in payload.terrain) data.perimeter = payload.terrain.perimeter ?? null;
      if ("additionalWidth" in payload.terrain) data.additionalWidth = payload.terrain.additionalWidth ?? null;
      if ("additionalLength" in payload.terrain) data.additionalLength = payload.terrain.additionalLength ?? null;
      if ("measurementModeUsed" in payload.terrain) {
        const normalizedMode = normalizeTerrainMeasurementMode(payload.terrain.measurementModeUsed);
        if (!normalizedMode) {
          throw new HttpError(400, "terrain.measurementModeUsed es invalido");
        }
        data.measurementModeUsed = normalizedMode;
      } else {
        data.measurementModeUsed = deriveTerrainMeasurementMode({
          width: "width" in payload.terrain ? payload.terrain.width : existing.width,
          length: "length" in payload.terrain ? payload.terrain.length : existing.length,
          totalArea: "totalArea" in payload.terrain ? payload.terrain.totalArea : existing.totalArea,
          area: "area" in payload.terrain ? payload.terrain.area : existing.area,
          perimeter: "perimeter" in payload.terrain ? payload.terrain.perimeter : existing.perimeter,
        });
      }
    }

    if (payload.location !== undefined) {
      if (payload.location?.sectors?.id !== undefined) {
        const sId = Number(payload.location.sectors.id);
        if (sId) {
          const s = await tx.sector.findUnique({ where: { id: sId } });
          if (!s) throw new HttpError(404, "Sector no encontrado");
          data.sectorId = sId;
        } else {
          throw new HttpError(400, "location.sectors.id es obligatorio");
        }
      }
      if ("mz" in payload.location) data.mz = payload.location.mz ?? null;
      if ("lot" in payload.location) data.lot = payload.location.lot ?? null;
    }

    if (payload.borders !== undefined) {
      if ("north" in payload.borders) data.north = payload.borders.north ?? null;
      if ("south" in payload.borders) data.south = payload.borders.south ?? null;
      if ("east" in payload.borders) data.east = payload.borders.east ?? null;
      if ("west" in payload.borders) data.west = payload.borders.west ?? null;
    }

    if (payload.additionalNotes !== undefined) {
      const additionalNotes = normalizeAdditionalNotes(payload.additionalNotes);
      if (additionalNotes.length > MAX_ADDITIONAL_NOTES_LENGTH) {
        throw new HttpError(400, `Las notas adicionales no pueden superar ${MAX_ADDITIONAL_NOTES_LENGTH} caracteres`);
      }
      data.additionalNotes = additionalNotes || null;
    }

    if (payload.requestNumber !== undefined) {
      data.requestNumber = payload.requestNumber || "";
    }

    if (payload.certificateRequestId !== undefined) {
      data.certificateRequestId = payload.certificateRequestId ?? null;
    }

    if (payload.status !== undefined) {
      const normalized = normalizeCertificateStatus(payload.status);
      if (!normalized) {
        throw new HttpError(400, "Estado de certificado invalido");
      }
      data.status = normalized;
      nextStatus = normalized;
    }

    if (Object.keys(data).length > 0) {
      await tx.certificate.update({
        where: { id },
        data,
      });
    }

    if (ownerIdsToSync) {
      await syncCertificateOwners(tx, id, ownerIdsToSync);
    }

    if (nextStatus && nextStatus !== existing.status) {
      await recordDocumentStatusHistory(tx, {
        documentType: DOCUMENT_TYPES.CERTIFICATE,
        documentId: id,
        status: nextStatus,
        changedByUserId,
      });
    }

    return tx.certificate.findUnique({
      where: { id },
      include: certificateInclude,
    });
  });

  return formatCertificateResponse(certificate);
};

const deleteCertificate = async (id) => {
  const preview = await getCertificateDeletePreview(id);
  if (!preview.canDelete) {
    throw new HttpError(409, "No se puede eliminar el certificado porque tiene dependencias asociadas");
  }
  await prisma.certificate.delete({ where: { id } });
};

const getCertificateByNumber = async (certificateNumber) => {
  const certificate = await prisma.certificate.findFirst({
    where: { certificateNumber },
    include: certificateInclude,
  });

  if (!certificate) {
    throw new HttpError(404, "Certificado no encontrado");
  }

  return formatCertificateResponse(certificate);
};

const getCertificateVerificationByToken = async (token) => {
  const certificate = await prisma.certificate.findUnique({
    where: { verificationToken: token },
    include: certificateInclude,
  });

  if (!certificate) {
    throw new HttpError(404, "Certificado no encontrado");
  }

  return buildCertificateVerificationPayload(formatCertificateResponse(certificate));
};

module.exports = {
  listCertificates,
  getCertificateById,
  getCertificateByNumber,
  getCertificateVerificationByToken,
  createCertificate,
  updateCertificate,
  deleteCertificate,
  getCertificateDeletePreview,
};
