const CERTIFICATE_STATUS_TO_DB = {
  "Por Firmar": "PorFirmar",
  PorFirmar: "PorFirmar",
  "Por Recoger": "PorRecoger",
  PorRecoger: "PorRecoger",
  Entregado: "Entregado",
};

const CERTIFICATE_STATUS_FROM_DB = {
  PorFirmar: "Por Firmar",
  PorRecoger: "Por Recoger",
  Entregado: "Entregado",
};

const {
  TERRAIN_MEASUREMENT_MODES,
} = require("../../../constants/terrain-type-configs");
const { formatTerrainTypeConfig } = require("../../terrain-types/utils/terrain-types.utils");

const normalizeCertificateStatus = (value) => CERTIFICATE_STATUS_TO_DB[value] || null;

const normalizeTerrainMeasurementMode = (value) => {
  if (!value) return null;
  return Object.values(TERRAIN_MEASUREMENT_MODES).includes(value) ? value : null;
};

const deriveTerrainMeasurementMode = (terrain = {}) => {
  const hasAreaPerimeter = terrain.area != null || terrain.perimeter != null;
  const hasWidthOrLength = terrain.width != null || terrain.length != null;
  const hasTotalArea = terrain.totalArea != null;

  if (hasAreaPerimeter) return TERRAIN_MEASUREMENT_MODES.AREA_PERIMETER;
  if (!hasWidthOrLength && hasTotalArea) return TERRAIN_MEASUREMENT_MODES.MANUAL_TOTAL_AREA;
  return TERRAIN_MEASUREMENT_MODES.RECTANGULAR_AUTO;
};

const formatCertificateStatus = (value) => CERTIFICATE_STATUS_FROM_DB[value] || value;

const decimalToNumber = (value) => (value ? Number(value) : null);

const formatCertificateResponse = (certificate) => {
  const owners = Array.isArray(certificate.owners) && certificate.owners.length > 0
    ? certificate.owners.map((owner) => ({
        id: owner.client?.id || null,
        fullName: owner.client?.fullName || "",
        documentNumber: owner.client?.documentNumber || "",
        order: owner.order,
        source: owner.source || null,
      }))
    : [];

  if (owners.length === 0) {
    if (certificate.client) owners.push({ id: certificate.client.id, fullName: certificate.client.fullName, documentNumber: certificate.client.documentNumber, order: 1, source: "certificate.client" });
    if (certificate.partner) owners.push({ id: certificate.partner.id, fullName: certificate.partner.fullName, documentNumber: certificate.partner.documentNumber, order: 2, source: "certificate.partner" });
  }

  return {
    id: certificate.id,
    verificationToken: certificate.verificationToken || null,
    certificateRequestId: certificate.certificateRequestId || null,
    owners,
    terrain: {
      terrainType: certificate.terrainType
        ? {
          id: certificate.terrainType.id,
          name: certificate.terrainType.name,
          terrainTypeConfigId: certificate.terrainType.terrainTypeConfigId,
          config: formatTerrainTypeConfig(certificate.terrainType.config),
        }
        : null,
      width: decimalToNumber(certificate.width),
      length: decimalToNumber(certificate.length),
      totalArea: decimalToNumber(certificate.totalArea),
      area: decimalToNumber(certificate.area),
      perimeter: decimalToNumber(certificate.perimeter),
      additionalWidth: decimalToNumber(certificate.additionalWidth),
      additionalLength: decimalToNumber(certificate.additionalLength),
      measurementModeUsed: certificate.measurementModeUsed,
    },
    legacyPayload: certificate.legacyPayload || null,
    location: {
      sectors: certificate.sector
        ? { id: certificate.sector.id, name: certificate.sector.name }
        : null,
      mz: certificate.mz || null,
      lot: certificate.lot || null,
    },
    borders: {
      north: certificate.north || null,
      south: certificate.south || null,
      east: certificate.east || null,
      west: certificate.west || null,
    },
    certificateNumber: certificate.certificateNumber,
    requestNumber: certificate.requestNumber || null,
    additionalNotes: certificate.additionalNotes || null,
    status: formatCertificateStatus(certificate.status),
    createdBy: {
      dni: certificate.user?.dni || null,
      role: certificate.user?.role?.name || null,
    },
    createdAt: certificate.createdAt,
    updatedAt: certificate.updatedAt,
  };
};

const buildCertificateFilters = (query) => {
  const where = {};

  if (query.certificateNumber) {
    where.certificateNumber = { contains: query.certificateNumber };
  }

  if (query.requestNumber) {
    where.requestNumber = { contains: query.requestNumber };
  }

  if (query.mz) {
    where.mz = { contains: query.mz };
  }

  if (query.lot) {
    where.lot = { contains: query.lot };
  }

  if (query.status) {
    where.status = normalizeCertificateStatus(query.status) || query.status;
  }

  if (query.sectorId) {
    where.sectorId = Number(query.sectorId);
  }

  if (query.terrainTypeId) {
    where.terrainTypeId = Number(query.terrainTypeId);
  }

  if (query.createdByRoleId) {
    where.user = { roleId: Number(query.createdByRoleId) };
  }

  if (query.search) {
    const s = query.search;
    const clientSearch = {
      OR: [
        { fullName: { contains: s, mode: "insensitive" } },
        { documentNumber: { contains: s, mode: "insensitive" } },
      ],
    };
    where.AND = [
      {
        OR: [
          { certificateNumber: { contains: s, mode: "insensitive" } },
          { requestNumber: { contains: s, mode: "insensitive" } },
          { certificateRequest: { requestNumber: { contains: s, mode: "insensitive" } } },
          { client: clientSearch },
          { partner: clientSearch },
          { owners: { some: { client: clientSearch } } },
        ],
      },
    ];
  }

  if (query.name || query.documentNumber) {
    const clientConditions = [];
    if (query.name) clientConditions.push({ fullName: { contains: query.name, mode: "insensitive" } });
    if (query.documentNumber) clientConditions.push({ documentNumber: { contains: query.documentNumber, mode: "insensitive" } });
    const clientFilter = clientConditions.length > 0 ? { AND: clientConditions } : undefined;

    const existingAND = where.AND || [];
    where.AND = [
      ...existingAND,
      {
      OR: [
        clientFilter ? { client: clientFilter } : undefined,
        clientFilter ? { partner: clientFilter } : undefined,
        clientFilter ? { owners: { some: { client: clientFilter } } } : undefined,
      ].filter(Boolean),
      },
    ];
  }

  return where;
};

module.exports = {
  normalizeCertificateStatus,
  normalizeTerrainMeasurementMode,
  deriveTerrainMeasurementMode,
  formatCertificateStatus,
  formatCertificateResponse,
  buildCertificateFilters,
};
