const normalizeText = (value) => String(value ?? "").trim();

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

const normalizeDateText = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const buildCertificateSnapshot = (certificate) => ({
  certificateNumber: normalizeText(certificate.certificateNumber),
  clientName: (certificate.owners || [])
    .map((owner) => normalizeText(owner.fullName))
    .filter(Boolean)
    .join(", "),
  clientDocuments: (certificate.owners || [])
    .map((owner) => normalizeText(owner.documentNumber))
    .filter(Boolean)
    .join(", "),
  terrainType: normalizeText(certificate.terrain?.terrainType?.name),
  sector: normalizeText(certificate.location?.sectors?.name),
  width: toNumber(certificate.terrain?.width),
  length: toNumber(certificate.terrain?.length),
  totalArea: toNumber(certificate.terrain?.totalArea),
  area: toNumber(certificate.terrain?.area),
  perimeter: toNumber(certificate.terrain?.perimeter),
  additionalWidth: toNumber(certificate.terrain?.additionalWidth),
  additionalLength: toNumber(certificate.terrain?.additionalLength),
  mz: normalizeText(certificate.location?.mz) || null,
  lot: normalizeText(certificate.location?.lot) || null,
  additionalNotes: normalizeText(certificate.additionalNotes) || null,
  createdAt: normalizeDateText(certificate.createdAt),
  borders: {
    north: normalizeText(certificate.borders?.north) || null,
    south: normalizeText(certificate.borders?.south) || null,
    east: normalizeText(certificate.borders?.east) || null,
    west: normalizeText(certificate.borders?.west) || null,
  },
});

const buildCertificateVerificationPayload = (certificate) => {
  return {
    verificationToken: certificate.verificationToken || null,
    certificate: buildCertificateSnapshot(certificate),
  };
};

const buildCertificateVerificationUrl = (token) => {
  const frontendUrl = String(process.env.FRONTEND_URL || "http://localhost:9000")
    .split(",")[0]
    .replace(/\/$/, "");
  return `${frontendUrl}/verificar-certificado/${encodeURIComponent(token)}`;
};

module.exports = {
  buildCertificateVerificationPayload,
  buildCertificateVerificationUrl,
};
