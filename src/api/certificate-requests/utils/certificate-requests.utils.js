const { formatClientResponse } = require("../../clients/utils/clients.utils");
const {
  normalizeAttachments,
  normalizeCertificateTypes,
  normalizeRequestDestination,
} = require("./certificate-request-legacy.utils");

const buildRequestNumber = (sequence, date = new Date()) => {
  const year = String(date.getFullYear()).slice(-2);
  return `${String(sequence).padStart(6, "0")}-${year}`;
};

const formatCertificateRequestResponse = (request) => {
  const client = formatClientResponse(request.client || {}) || {};
  const partner = formatClientResponse(request.partner || {}) || {};
  const user = request.user || {};
  const legacyPayload = request.legacyPayload || null;

  return {
    id: request.id,
    requestNumber: request.requestNumber,
    isComunero: client.clientType === "Comunero",
    destination: normalizeRequestDestination(request.destination, legacyPayload?.destination),
    requestDescription: request.requestDescription || request.description || legacyPayload?.requestDescription || legacyPayload?.description || "",
    sectorLocation: request.sectorLocation || legacyPayload?.sectorLocation || "",
    client: {
      id: client.id || null,
      searchType: "Reniec",
      fullName: client.fullName || "",
      documentNumber: client.documentNumber || "",
      address: client.address || "",
      nro_licence: client.nro_licence || null,
    },
    partnerClient: {
      id: partner.id || null,
      searchType: partner.id ? "Reniec" : "",
      fullName: partner.fullName || "",
      documentNumber: partner.documentNumber || "",
      address: partner.address || "",
      nro_licence: partner.nro_licence || null,
    },
    certificateTypes: normalizeCertificateTypes(request.certificateTypes || [], legacyPayload),
    exposure: request.exposure || legacyPayload?.exposure || "",
    attachments: normalizeAttachments(request.attachments || [], legacyPayload),
    createdBy: {
      dni: user?.dni || "",
      role: user?.role?.name || "",
    },
    legacyPayload,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
};

module.exports = {
  buildRequestNumber,
  normalizeCertificateTypes,
  normalizeAttachments,
  formatCertificateRequestResponse,
};
