const { normalizeComparableText } = require("../../certificate-requests/utils/certificate-request-legacy.utils");

const buildAssemblyRequestCode = (sequence) => `SOL-ACTA-${String(sequence).padStart(6, "0")}`;

const LEGACY_ATTACHMENT_LABELS = [
  { token: "CertPosesion", label: "Certificado de posesion" },
  { token: "PlanoMemoria", label: "Plano y memoria" },
  { token: "DniCompradores", label: "DNI de los adjudicadores o compradores" },
  { token: "DniVendedor", label: "DNI del vendedor" },
  { token: "ContratoCV", label: "Contrato compra venta notariado" },
  { token: "Testimonio", label: "Testimonio de adjudicacion" },
  { token: "ObservacionRegistros", label: "Observacion de Registros (Esquela de observacion)" },
];

const normalizeAssemblyRecordAttachmentLabel = (value) => {
  const normalized = normalizeComparableText(value);

  if (!normalized) {
    return null;
  }

  if (normalized.includes("certificado") && normalized.includes("posesion")) {
    return "CertPosesion";
  }

  if (normalized.includes("plano") && normalized.includes("memoria")) {
    return "PlanoMemoria";
  }

  if (normalized.includes("dni") && normalized.includes("compr")) {
    return "DniCompradores";
  }

  if (normalized.includes("dni") && normalized.includes("vend")) {
    return "DniVendedor";
  }

  if (normalized.includes("compra") && normalized.includes("venta")) {
    return "ContratoCV";
  }

  if (normalized.includes("testimonio")) {
    return "Testimonio";
  }

  if (normalized.includes("observacion") || normalized.includes("esquela")) {
    return "ObservacionRegistros";
  }

  if (normalized.includes("celular") || normalized.includes("telefono")) {
    return "Celular";
  }

  return String(value || "").trim();
};

const normalizeAssemblyRecordAttachments = (items = [], legacyPayload = null) => {
  const sourceItems = [
    ...((Array.isArray(items) ? items : []) || []),
    ...((Array.isArray(legacyPayload?.attach) ? legacyPayload.attach : []) || []).map((type) => ({ type })),
    ...((Array.isArray(legacyPayload?.attachment) ? legacyPayload.attachment : []) || []).map((type) => ({ type })),
    ...((Array.isArray(legacyPayload?.attachments) ? legacyPayload.attachments : []) || []).map((type) => ({ type })),
  ];

  const normalizedItems = [];
  const seen = new Set();

  for (const item of sourceItems) {
    const rawType = typeof item === "string" ? item : item?.type;
    const normalizedType = normalizeAssemblyRecordAttachmentLabel(rawType);

    if (!normalizedType) {
      continue;
    }

    const signature = normalizeComparableText(normalizedType);
    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    normalizedItems.push({ type: normalizedType });
  }

  return normalizedItems;
};

const normalizeAssemblyRecordLegacyAttachments = (items = [], legacyPayload = null) => {
  const sourceItems = [
    ...((Array.isArray(items) ? items : []) || []),
    ...((Array.isArray(legacyPayload?.attach) ? legacyPayload.attach : []) || []),
    ...((Array.isArray(legacyPayload?.attachment) ? legacyPayload.attachment : []) || []),
    ...((Array.isArray(legacyPayload?.attachments) ? legacyPayload.attachments : []) || []),
  ];

  const normalizedItems = [];
  const seen = new Set();

  for (const { token, label } of LEGACY_ATTACHMENT_LABELS) {
    const tokenKey = normalizeComparableText(token);
    const labelKey = normalizeComparableText(label);

    if (sourceItems.some((item) => {
      const raw = typeof item === "string" ? item : item?.type;
      const normalized = normalizeComparableText(raw);
      return normalized === tokenKey || normalized === labelKey;
    })) {
      normalizedItems.push(label);
      seen.add(labelKey);
    }
  }

  for (const item of sourceItems) {
    const raw = typeof item === "string" ? item : item?.type;
    const normalized = normalizeComparableText(raw);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    normalizedItems.push(String(raw || "").trim());
    seen.add(normalized);
  }

  return normalizedItems;
};

const formatAssemblyRecordRequestResponse = (request) => {
  const client = request.client || {};
  const certificate = request.certificate || {};
  const user = request.user || {};
  const legacyPayload = request.legacyPayload || null;

  const buyerFullName = request.buyerFullName || legacyPayload?.buyerFullName || client.fullName || "";
  const sellerFullName = request.sellerFullName || legacyPayload?.sellerFullName || "";
  const sectorLocation = request.sectorLocation || legacyPayload?.sectorLocation || certificate.sector?.name || "";
  const terrainType = request.terrainType || legacyPayload?.terrainType || certificate.terrainType?.name || "";
  const awardDate = request.awardDate || legacyPayload?.awardDate || null;
  const possessionTime = request.possessionTime || legacyPayload?.possessionTime || "";
  const email = request.email || legacyPayload?.email || "";
  const phone = request.phone || legacyPayload?.phone || "";
  const legacyAttachments = normalizeAssemblyRecordLegacyAttachments(request.attachments || [], legacyPayload);

  return {
    _id: request.code,
    description: request.description || legacyPayload?.description || "",
    typeUser: legacyPayload?.typeUser || (client.commoner ? "comunero" : "no comunero"),
    buyerFullName,
    idCertificado: certificate.certificateNumber || legacyPayload?.idCertificado || "",
    sellerFullName,
    sectorLocation,
    terrainType,
    awardDate,
    possessionTime,
    email,
    phone,
    attach: legacyAttachments,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    id: request.id,
    code: request.code,
    clientId: request.clientId,
    certificateId: request.certificateId,
    userId: request.userId,
    attachments: normalizeAssemblyRecordAttachments(request.attachments || [], legacyPayload),
    client: {
      id: client.id || null,
      fullName: client.fullName || "",
      documentNumber: client.documentNumber || "",
    },
    certificate: {
      id: certificate.id || null,
      certificateNumber: certificate.certificateNumber || "",
      width: certificate.width ?? null,
      length: certificate.length ?? null,
      area: certificate.area ?? null,
      totalArea: certificate.totalArea ?? null,
      sector: certificate.sector ? { id: certificate.sector.id, name: certificate.sector.name } : null,
      terrainType: certificate.terrainType ? { id: certificate.terrainType.id, name: certificate.terrainType.name } : null,
    },
    user: user?.id ? { id: user.id, fullName: user.fullName || "" } : null,
    legacyPayload,
  };
};

module.exports = {
  buildAssemblyRequestCode,
  formatAssemblyRecordRequestResponse,
  normalizeAssemblyRecordAttachments,
  normalizeAssemblyRecordAttachmentLabel,
  normalizeAssemblyRecordLegacyAttachments,
};
