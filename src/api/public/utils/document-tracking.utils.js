const { normalizeComparableText } = require("../../certificate-requests/utils/certificate-request-legacy.utils");

const LIMA_TIME_ZONE = "America/Lima";
const LIMA_OFFSET_MINUTES = -5 * 60;

const formatDateTimeInLima = (value) => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const limaDate = new Date(date.getTime() + (LIMA_OFFSET_MINUTES * 60 * 1000));
  const pad = (n) => String(n).padStart(2, "0");

  return [
    `${limaDate.getUTCFullYear()}-${pad(limaDate.getUTCMonth() + 1)}-${pad(limaDate.getUTCDate())}`,
    `${pad(limaDate.getUTCHours())}:${pad(limaDate.getUTCMinutes())}:${pad(limaDate.getUTCSeconds())}-05:00`,
  ].join("T");
};

const CERTIFICATE_TYPES = [
  { key: "PorFirmar", label: "Por firmar" },
  { key: "PorRecoger", label: "Por recoger" },
  { key: "Entregado", label: "Entregado" },
];

const CERTIFICATE_REQUEST_TYPES = [
  { key: "EnProceso", label: "En proceso" },
  { key: "Observado", label: "Observado" },
  { key: "Recepcionado", label: "Recepcionado" },
];

const ASSEMBLY_RECORD_REQUEST_TYPES = [
  { key: "EnProceso", label: "En proceso" },
  { key: "PorRecoger", label: "Por recoger" },
  { key: "Entregado", label: "Entregado" },
];

const DOCUMENT_TYPE_CONFIG = {
  certificate: {
    label: "Certificado",
    history: CERTIFICATE_TYPES,
  },
  certificate_request: {
    label: "Solicitud de certificado",
    history: CERTIFICATE_REQUEST_TYPES,
  },
  assembly_record_request: {
    label: "Acta de asamblea",
    history: ASSEMBLY_RECORD_REQUEST_TYPES,
  },
};

const HISTORY_LABEL_BY_TYPE = {
  certificate: Object.fromEntries(CERTIFICATE_TYPES.map((item) => [item.key, item.label])),
  certificate_request: Object.fromEntries(CERTIFICATE_REQUEST_TYPES.map((item) => [item.key, item.label])),
  assembly_record_request: Object.fromEntries(ASSEMBLY_RECORD_REQUEST_TYPES.map((item) => [item.key, item.label])),
};

const buildPeople = (people = []) => people.filter((person) => person && (person.fullName || person.documentNumber));

const buildFields = (fields = []) => fields.filter((field) => field && (field.value !== undefined && field.value !== null && String(field.value).trim() !== ""));

const formatCertificateRequestTypes = (types = []) => (Array.isArray(types) ? types : [])
  .map((item) => {
    const normalized = normalizeComparableText(item?.type);

    if (normalized.includes("certificado") && normalized.includes("posesion")) return "Certificado de posesión";
    if (normalized.includes("plano") && normalized.includes("memoria")) return "Plano y memoria";
    if (normalized.includes("otros")) return item?.otherType || "Otros";

    return String(item?.type || "").trim();
  })
  .filter(Boolean)
  .join(", ");

const buildTrackingTimeline = ({ documentType, currentStatus, createdAt = null, historyRows = [] }) => {
  const steps = DOCUMENT_TYPE_CONFIG[documentType]?.history || [];
  const labelByStatus = HISTORY_LABEL_BY_TYPE[documentType] || {};
  const currentIndex = steps.findIndex((step) => normalizeComparableText(step.label) === normalizeComparableText(currentStatus));
  const historyByStatus = new Map();

  for (const row of historyRows) {
    historyByStatus.set(row.status, row.changedAt);
  }

  return steps.map((step, index) => {
    const isDone = currentIndex >= 0 ? index <= currentIndex : historyByStatus.has(step.key);
    const statusDate = index === 0
      ? createdAt
      : historyByStatus.get(step.key) || null;
    return {
      status: labelByStatus[step.key] || step.label,
      date: isDone ? formatDateTimeInLima(statusDate) : null,
      done: isDone,
    };
  });
};

const normalizeCurrentStatusLabel = (documentType, currentStatus) => {
  const steps = DOCUMENT_TYPE_CONFIG[documentType]?.history || [];
  const match = steps.find((step) => normalizeComparableText(step.label) === normalizeComparableText(currentStatus));
  return match?.label || currentStatus;
};

const buildTrackingResponse = ({
  documentType,
  code,
  currentStatus,
  createdAt,
  information,
  historyRows,
}) => {
  const config = DOCUMENT_TYPE_CONFIG[documentType];

  if (!config) {
    throw new Error(`Tipo de documento no soportado: ${documentType}`);
  }

  return {
    documentType,
    title: config.label,
    code,
    currentStatus: normalizeCurrentStatusLabel(documentType, currentStatus),
    information: {
      people: buildPeople(information.people),
      fields: buildFields(information.fields),
    },
    history: buildTrackingTimeline({ documentType, currentStatus, createdAt, historyRows }),
  };
};

module.exports = {
  DOCUMENT_TYPE_CONFIG,
  formatCertificateRequestTypes,
  buildTrackingResponse,
};
