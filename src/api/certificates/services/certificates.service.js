const { randomUUID } = require("crypto");
const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const {
  normalizeCertificateStatus,
  normalizeTerrainMeasurementMode,
  deriveTerrainMeasurementMode,
  formatCertificateResponse,
  buildCertificateFilters,
} = require("../utils/certificates.utils");
const { makeDeletionPreview, makeImpactItem } = require("../../../utils/deletion-preview");
const {
  buildCertificateVerificationSnapshot,
  buildCertificateVerificationPayload,
} = require("../utils/certificate-verification.utils");

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

const normalizeOwnerIds = (owners = []) => [...new Set(owners.map((o) => Number(o.id)).filter((id) => id > 0))];

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

const resolveOwnerClients = async (ownerIds) => {
  if (ownerIds.length === 0) {
    throw new HttpError(400, "Debe proporcionar al menos un propietario");
  }

  const clients = await prisma.client.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, fullName: true, documentNumber: true },
  });

  if (clients.length !== ownerIds.length) {
    const existingIds = new Set(clients.map((client) => client.id));
    const missing = ownerIds.find((id) => !existingIds.has(id));
    if (missing) {
      throw new HttpError(404, missing === ownerIds[0] ? "Cliente no encontrado" : "Uno de los propietarios no fue encontrado");
    }
  }

  const byId = new Map(clients.map((client) => [client.id, client]));
  return ownerIds.map((id) => byId.get(id));
};

const nextCertificateNumber = async () => {
  const last = await prisma.certificate.findFirst({
    orderBy: { certificateNumber: "desc" },
    select: { certificateNumber: true },
  });

  const lastNum = last ? parseInt(last.certificateNumber, 10) : 0;
  return String(lastNum + 1).padStart(6, "0");
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

  return formatCertificateResponse(await ensureCertificateVerificationData(certificate));
};

const ensureCertificateVerificationData = async (certificate) => {
  if (!certificate) return certificate;

  const updates = {};
  if (!certificate.verificationToken) {
    updates.verificationToken = randomUUID();
  }

  if (!certificate.issuedSnapshot) {
    updates.issuedSnapshot = buildCertificateVerificationSnapshot(certificate);
  }

  if (Object.keys(updates).length === 0) {
    return certificate;
  }

  await prisma.certificate.update({
    where: { id: certificate.id },
    data: updates,
  });

  return prisma.certificate.findUnique({
    where: { id: certificate.id },
    include: certificateInclude,
  });
};

const createCertificate = async (payload, userId) => {
  if (!userId) {
    throw new HttpError(401, "Usuario autenticado requerido");
  }

  const ownerClients = await resolveOwnerClients(normalizeOwnerIds(payload.owners || []));
  const ownerIds = ownerClients.map((owner) => owner.id);
  const clientId = ownerIds[0];
  const partnerId = ownerIds[1] || null;

  let linkedRequest = null;
  if (payload.certificateRequestId !== undefined && payload.certificateRequestId !== null) {
    linkedRequest = await prisma.certificateRequest.findUnique({
      where: { id: Number(payload.certificateRequestId) },
      select: { id: true, clientId: true },
    });
    if (!linkedRequest) {
      throw new HttpError(404, "Solicitud de certificado no encontrada");
    }
    if (linkedRequest.clientId !== clientId) {
      throw new HttpError(400, "La solicitud no corresponde al titular principal");
    }
  }

  const terrainTypeId = Number(payload.terrain?.terrainType?.id);
  if (!terrainTypeId) {
    throw new HttpError(400, "terrain.terrainType.id es obligatorio");
  }
  const terrainType = await prisma.terrainType.findUnique({ where: { id: terrainTypeId } });
  if (!terrainType) {
    throw new HttpError(404, "Tipo de terreno no encontrado");
  }

  const sectorId = Number(payload.location?.sectors?.id);
  if (!sectorId) {
    throw new HttpError(400, "location.sectors.id es obligatorio");
  }
  const sector = await prisma.sector.findUnique({ where: { id: sectorId } });
  if (!sector) {
    throw new HttpError(404, "Sector no encontrado");
  }

  const certificateNumber = await nextCertificateNumber();
  const statusNormalized = normalizeCertificateStatus(payload.status) || "PorFirmar";
  const measurementModeUsed = normalizeTerrainMeasurementMode(payload.terrain?.measurementModeUsed)
    || deriveTerrainMeasurementMode(payload.terrain);

  const certificate = await prisma.$transaction(async (tx) => {
    const created = await tx.certificate.create({
      data: {
        certificateNumber,
        requestNumber: payload.requestNumber || "",
        certificateRequestId: linkedRequest?.id ?? null,
        clientId,
        partnerId,
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
        status: statusNormalized,
      },
      select: { id: true },
    });

    await syncCertificateOwners(tx, created.id, ownerIds);

    const withOwners = await tx.certificate.findUnique({
      where: { id: created.id },
      include: certificateInclude,
    });

    const snapshot = buildCertificateVerificationSnapshot(withOwners);
    await tx.certificate.update({
      where: { id: created.id },
      data: { issuedSnapshot: snapshot },
    });

    return tx.certificate.findUnique({
      where: { id: created.id },
      include: certificateInclude,
    });
  });

  return formatCertificateResponse(await ensureCertificateVerificationData(certificate));
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

const updateCertificate = async (id, payload) => {
  const existing = await prisma.certificate.findUnique({
    where: { id },
    include: certificateInclude,
  });

  if (!existing) {
    throw new HttpError(404, "Certificado no encontrado");
  }

  const data = {};
  let ownerIdsToSync = null;

  if (payload.owners) {
    ownerIdsToSync = (await resolveOwnerClients(normalizeOwnerIds(payload.owners))).map((owner) => owner.id);
    data.clientId = ownerIdsToSync[0];
    data.partnerId = ownerIdsToSync[1] || null;
  }

  const effectiveClientId = data.clientId || existing.clientId;

  if (payload.certificateRequestId !== undefined) {
    const linkedRequest = payload.certificateRequestId === null
      ? null
      : await prisma.certificateRequest.findUnique({
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
    const linkedRequest = await prisma.certificateRequest.findUnique({
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
        const tt = await prisma.terrainType.findUnique({ where: { id: ttId } });
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
        const s = await prisma.sector.findUnique({ where: { id: sId } });
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
  }

  let certificate;
  if (Object.keys(data).length > 0 || ownerIdsToSync) {
    certificate = await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.certificate.update({
          where: { id },
          data,
        });
      }

      if (ownerIdsToSync) {
        await syncCertificateOwners(tx, id, ownerIdsToSync);
      }

      return tx.certificate.findUnique({
        where: { id },
        include: certificateInclude,
      });
    });
  } else {
    certificate = await prisma.certificate.findUnique({
      where: { id },
      include: certificateInclude,
    });
  }

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

  return formatCertificateResponse(await ensureCertificateVerificationData(certificate));
};

const getCertificateVerificationByToken = async (token) => {
  const certificate = await prisma.certificate.findUnique({
    where: { verificationToken: token },
    include: certificateInclude,
  });

  if (!certificate) {
    throw new HttpError(404, "Certificado no encontrado");
  }

  const persisted = await ensureCertificateVerificationData(certificate);

  return buildCertificateVerificationPayload(formatCertificateResponse(persisted));
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
