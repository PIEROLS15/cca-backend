const { formatClientResponse } = require("../../clients/utils/clients.utils");
const {
  normalizeAttachments,
  normalizeCertificateTypes,
  normalizeRequestDestination,
} = require("./certificate-request-legacy.utils");

const CERTIFICATE_REQUEST_STATUS_TO_DB = {
  Recepcionado: "Recepcionado",
  "En Proceso": "Recepcionado",
  "Por Firmar": "PorFirmar",
  PorFirmar: "PorFirmar",
  "Por Recoger": "PorRecoger",
  PorRecoger: "PorRecoger",
  Entregado: "Entregado",
  Observado: "Observado",
};

const CERTIFICATE_REQUEST_STATUS_FROM_DB = {
  Recepcionado: "Recepcionado",
  PorFirmar: "Por Firmar",
  PorRecoger: "Por Recoger",
  Entregado: "Entregado",
  Observado: "Observado",
};

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
      searchType: client.clientCode && !client.documentNumber ? "Codigo" : "Reniec",
      fullName: client.fullName || "",
      documentNumber: client.documentNumber || client.clientCode || "",
      clientCode: client.clientCode || null,
      address: client.address || "",
      nro_licence: client.nro_licence || null,
    },
    partnerClient: {
      id: partner.id || null,
      searchType: partner.clientCode && !partner.documentNumber ? "Codigo" : (partner.id ? "Reniec" : ""),
      fullName: partner.fullName || "",
      documentNumber: partner.documentNumber || partner.clientCode || "",
      clientCode: partner.clientCode || null,
      address: partner.address || "",
      nro_licence: partner.nro_licence || null,
    },
    certificateTypes: normalizeCertificateTypes(request.certificateTypes || [], legacyPayload),
    exposure: request.exposure || legacyPayload?.exposure || "",
    attachments: normalizeAttachments(request.attachments || [], legacyPayload),
    status: CERTIFICATE_REQUEST_STATUS_FROM_DB[request.status] || request.status || "Recepcionado",
    statusNote: request.statusNote || null,
    createdBy: {
      dni: user?.dni || "",
      role: user?.role?.name || "",
    },
    legacyPayload,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
};

const normalizeCertificateRequestStatus = (value) => CERTIFICATE_REQUEST_STATUS_TO_DB[value] || null;

const formatCertificateRequestStatus = (value) => CERTIFICATE_REQUEST_STATUS_FROM_DB[value] || value;

module.exports = {
  buildRequestNumber,
  normalizeCertificateTypes,
  normalizeAttachments,
  formatCertificateRequestResponse,
  normalizeCertificateRequestStatus,
  formatCertificateRequestStatus,
};
