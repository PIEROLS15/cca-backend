const buildRequestCode = (sequence) => `SolCer${String(sequence).padStart(6, "0")}`;

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

const formatCertificateRequestResponse = (request) => ({
  id: request.id,
  requestNumber: request.requestNumber,
  isComunero: request.isComunero,
  destination: request.destination || "",
  status: request.status,
  requestDescription: request.requestDescription || request.description || "",
  sectorLocation: request.sectorLocation || "",
  client: {
    searchType: request.clientSearchType || "",
    fullName: request.clientFullName || request.client?.fullName || "",
    documentNumber: request.clientDocumentNumber || request.client?.documentNumber || "",
    address: request.clientAddress || request.client?.address || "",
  },
  partnerClient: {
    searchType: request.partnerSearchType || "",
    fullName: request.partnerFullName || "",
    documentNumber: request.partnerDocumentNumber || "",
    address: request.partnerAddress || "",
  },
  certificateTypes: Array.isArray(request.certificateTypes) ? request.certificateTypes : [],
  exposure: request.exposure || "",
  attachments: Array.isArray(request.attachments) ? request.attachments : [],
  createdBy: {
    dni: request.createdByDni || request.user?.dni || "",
    role: request.createdByRole || request.user?.role?.name || "",
  },
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
});

module.exports = {
  buildRequestCode,
  buildRequestNumber,
  normalizeValueToken,
  normalizeCertificateTypes,
  normalizeAttachments,
  formatCertificateRequestResponse,
};
