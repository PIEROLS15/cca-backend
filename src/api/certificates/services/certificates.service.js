const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const {
  normalizeCertificateStatus,
  formatCertificateResponse,
  buildCertificateFilters,
} = require("../utils/certificates.utils");

const certificateInclude = {
  client: true,
  partner: true,
  sector: true,
  terrainType: true,
  user: { include: { role: true } },
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
      orderBy: { certificateNumber: "desc" },
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

  const ownerIds = [...new Set((payload.owners || []).map((o) => Number(o.id)).filter((id) => id > 0))];

  if (ownerIds.length === 0) {
    throw new HttpError(400, "Debe proporcionar al menos un propietario");
  }

  const clientId = ownerIds[0];
  const partnerId = ownerIds.length > 1 ? ownerIds[1] : null;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    throw new HttpError(404, "Cliente no encontrado");
  }

  if (partnerId) {
    const partner = await prisma.client.findUnique({ where: { id: partnerId } });
    if (!partner) {
      throw new HttpError(404, "Partner no encontrado");
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

  if (!payload.requestNumber) {
    throw new HttpError(400, "requestNumber es obligatorio");
  }

  const certificateNumber = await nextCertificateNumber();
  const statusNormalized = normalizeCertificateStatus(payload.status) || "PorFirmar";

  const certificate = await prisma.certificate.create({
    data: {
      certificateNumber,
      requestNumber: payload.requestNumber,
      clientId,
      partnerId,
      sectorId,
      terrainTypeId,
      userId,
      width: payload.terrain?.width ?? null,
      length: payload.terrain?.length ?? null,
      totalArea: payload.terrain?.totalArea ?? null,
      mz: payload.location?.mz || null,
      lot: payload.location?.lot || null,
      north: payload.borders?.north || null,
      south: payload.borders?.south || null,
      east: payload.borders?.east || null,
      west: payload.borders?.west || null,
      status: statusNormalized,
    },
    include: certificateInclude,
  });

  return formatCertificateResponse(certificate);
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

  if (payload.owners) {
    const ownerIds = [...new Set(payload.owners.map((o) => Number(o.id)).filter((id) => id > 0))];
    if (ownerIds.length === 0) {
      throw new HttpError(400, "Debe proporcionar al menos un propietario");
    }
    const client = await prisma.client.findUnique({ where: { id: ownerIds[0] } });
    if (!client) throw new HttpError(404, "Cliente no encontrado");
    data.clientId = ownerIds[0];

    const partnerId = ownerIds.length > 1 ? ownerIds[1] : null;
    if (partnerId) {
      const partner = await prisma.client.findUnique({ where: { id: partnerId } });
      if (!partner) throw new HttpError(404, "Partner no encontrado");
    }
    data.partnerId = partnerId;
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
    if (!payload.requestNumber) throw new HttpError(400, "requestNumber no puede estar vacio");
    data.requestNumber = payload.requestNumber;
  }

  if (payload.status !== undefined) {
    const normalized = normalizeCertificateStatus(payload.status);
    if (!normalized) {
      throw new HttpError(400, "Estado de certificado invalido");
    }
    data.status = normalized;
  }

  if (Object.keys(data).length > 0) {
    await prisma.certificate.update({
      where: { id },
      data,
    });
  }

  const certificate = await prisma.certificate.findUnique({
    where: { id },
    include: certificateInclude,
  });

  return formatCertificateResponse(certificate);
};

const deleteCertificate = async (id) => {
  const certificate = await prisma.certificate.findUnique({ where: { id } });
  if (!certificate) {
    throw new HttpError(404, "Certificado no encontrado");
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

module.exports = {
  listCertificates,
  getCertificateById,
  getCertificateByNumber,
  createCertificate,
  updateCertificate,
  deleteCertificate,
};
