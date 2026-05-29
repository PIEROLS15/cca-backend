const { formatClientResponse } = require("../../clients/utils/clients.utils");

const buildRequestNumber = (sequence, date = new Date()) => {
  const year = String(date.getFullYear()).slice(-2);
  return `${String(sequence).padStart(6, "0")}-${year}`;
};

const normalizeValueToken = (value) => {
  if (!value) {
    return "";
  }

  return String(value)
    .trim()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join("");
};

const normalizeCertificateTypes = (items = []) =>
  items.map((item) => ({
    type: normalizeValueToken(item.type),
    otherType: item.otherType || undefined,
  }));

const normalizeAttachments = (items = []) =>
  items.map((item) => ({
    type: normalizeValueToken(item.type),
    phoneNumber: item.phoneNumber || undefined,
  }));

const formatCertificateRequestResponse = (request) => {
  const client = formatClientResponse(request.client || {}) || {};
  const partner = formatClientResponse(request.partner || {}) || {};
  const user = request.user || {};

  return {
    id: request.id,
    requestNumber: request.requestNumber,
    isComunero: client.clientType === "Comunero",
    destination: request.destination || "",
    status: request.status,
    requestDescription: request.requestDescription || request.description || "",
    sectorLocation: request.sectorLocation || "",
    client: {
      searchType: "Reniec",
      fullName: client.fullName || "",
      documentNumber: client.documentNumber || "",
      address: client.address || "",
      nro_licence: client.nro_licence || null,
    },
    partnerClient: {
      searchType: partner.id ? "Reniec" : "",
      fullName: partner.fullName || "",
      documentNumber: partner.documentNumber || "",
      address: partner.address || "",
      nro_licence: partner.nro_licence || null,
    },
    certificateTypes: Array.isArray(request.certificateTypes) ? request.certificateTypes : [],
    exposure: request.exposure || "",
    attachments: Array.isArray(request.attachments) ? request.attachments : [],
    createdBy: {
      dni: user?.dni || "",
      role: user?.role?.name || "",
    },
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
