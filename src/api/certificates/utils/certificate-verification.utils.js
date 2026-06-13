const normalizeText = (value) => String(value ?? "").trim();

const normalizeComparisonText = (value) => normalizeText(value)
  .replace(/\s+/g, " ")
  .toLowerCase();

const normalizeDateText = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

const buildCertificateVerificationSnapshot = (certificate) => ({
  certificateNumber: normalizeText(certificate.certificateNumber),
  clientName: (certificate.owners || [])
    .map((owner) => normalizeText(owner.fullName || owner.client?.fullName))
    .filter(Boolean)
    .join(", "),
  clientDocuments: (certificate.owners || [])
    .map((owner) => normalizeText(owner.documentNumber || owner.client?.documentNumber))
    .filter(Boolean)
    .join(", "),
  terrainType: normalizeText(certificate.terrain?.terrainType?.name || certificate.terrainType?.name),
  sector: normalizeText(certificate.location?.sectors?.name || certificate.sector || certificate.sectorName),
  width: toNumber(certificate.terrain?.width ?? certificate.width),
  length: toNumber(certificate.terrain?.length ?? certificate.length),
  totalArea: toNumber(certificate.terrain?.totalArea ?? certificate.totalArea),
  area: toNumber(certificate.terrain?.area ?? certificate.area),
  perimeter: toNumber(certificate.terrain?.perimeter ?? certificate.perimeter),
  additionalWidth: toNumber(certificate.terrain?.additionalWidth ?? certificate.additionalWidth),
  additionalLength: toNumber(certificate.terrain?.additionalLength ?? certificate.additionalLength),
  mz: normalizeText(certificate.location?.mz ?? certificate.mz) || null,
  lot: normalizeText(certificate.location?.lot ?? certificate.lot) || null,
  createdAt: normalizeDateText(certificate.createdAt),
  borders: {
    north: normalizeText(certificate.borders?.north ?? certificate.north) || null,
    south: normalizeText(certificate.borders?.south ?? certificate.south) || null,
    east: normalizeText(certificate.borders?.east ?? certificate.east) || null,
    west: normalizeText(certificate.borders?.west ?? certificate.west) || null,
  },
});

const buildCertificateVerificationDifferences = (issued, current) => {
  if (!issued) return [];

  const fields = [
    ["clientDocuments", "Documento(s) cliente"],
    ["terrainType", "Tipo de terreno"],
    ["sector", "Sector"],
    ["width", "Ancho"],
    ["length", "Largo"],
    ["totalArea", "Área total"],
    ["area", "Área"],
    ["perimeter", "Perímetro"],
    ["additionalWidth", "Ancho adicional"],
    ["additionalLength", "Largo adicional"],
    ["mz", "Mz"],
    ["lot", "Lote"],
    ["createdAt", "Fecha creación"],
  ];

  const diffs = [];
  for (const [key, label] of fields) {
    const issuedValue = typeof issued[key] === "string" ? normalizeComparisonText(issued[key]) : issued[key];
    const currentValue = typeof current[key] === "string" ? normalizeComparisonText(current[key]) : current[key];

    if (issuedValue !== currentValue) {
      diffs.push({
        field: key,
        label,
        issued: issued[key],
        current: current[key],
      });
    }
  }

  const borderLabels = {
    north: "Colindancia norte",
    south: "Colindancia sur",
    east: "Colindancia este",
    west: "Colindancia oeste",
  };

  for (const key of Object.keys(borderLabels)) {
    const issuedValue = normalizeComparisonText((issued.borders || {})[key]);
    const currentValue = normalizeComparisonText((current.borders || {})[key]);
    if (issuedValue !== currentValue) {
      diffs.push({
        field: `borders.${key}`,
        label: borderLabels[key],
        issued: (issued.borders || {})[key],
        current: (current.borders || {})[key],
      });
    }
  }

  return diffs;
};

const buildCertificateVerificationPayload = (certificate) => {
  const current = buildCertificateVerificationSnapshot(certificate);
  const issued = certificate.issuedSnapshot ? { ...current, ...certificate.issuedSnapshot } : current;
  const differences = buildCertificateVerificationDifferences(issued, current);

  return {
    verificationToken: certificate.verificationToken || null,
    isValid: differences.length === 0,
    certificate: current,
    issuedSnapshot: issued,
    differences,
  };
};

const buildCertificateVerificationUrl = (token) => {
  const frontendUrl = String(process.env.FRONTEND_URL || "http://localhost:9000").replace(/\/$/, "");
  return `${frontendUrl}/verificar-certificado/${encodeURIComponent(token)}`;
};

module.exports = {
  buildCertificateVerificationSnapshot,
  buildCertificateVerificationPayload,
  buildCertificateVerificationUrl,
};
