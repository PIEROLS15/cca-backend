const { normalizeComparableText } = require("../../certificate-requests/utils/certificate-request-legacy.utils");

const LIMA_OFFSET_MINUTES = -5 * 60;

const TRACKING_BASE_STEPS = [
  { key: "Recepcionado", label: "Recepcionado" },
  { key: "PorFirmar", label: "Por firmar" },
  { key: "PorRecoger", label: "Por recoger" },
  { key: "Entregado", label: "Entregado" },
];

const OBSERVED_STATUS = { key: "Observado", label: "Observado" };

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

const formatDateInLima = (value) => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const pad = (n) => String(n).padStart(2, "0");

  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
};

const CERTIFICATE_TYPES = TRACKING_BASE_STEPS;

const CERTIFICATE_REQUEST_TYPES = TRACKING_BASE_STEPS;

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

const normalizeTrackingStatusKey = (documentType, value) => {
  const normalized = normalizeComparableText(value);
  if (!normalized) return null;

  if (normalized.includes("observado")) return "Observado";
  if (normalized.includes("recepcionado")) return "Recepcionado";
  if (normalized.includes("enproceso")) {
    return documentType === "assembly_record_request" ? "EnProceso" : "Recepcionado";
  }
  if (normalized.includes("porfirmar")) return "PorFirmar";
  if (normalized.includes("porrecoger")) return "PorRecoger";
  if (normalized.includes("entregado")) return "Entregado";

  const steps = DOCUMENT_TYPE_CONFIG[documentType]?.history || [];
  const match = steps.find((step) => normalizeComparableText(step.key) === normalized || normalizeComparableText(step.label) === normalized);
  return match?.key || null;
};

const buildTrackingTimeline = ({ documentType, currentStatus, createdAt = null, historyRows = [] }) => {
  const steps = DOCUMENT_TYPE_CONFIG[documentType]?.history || [];
  const labelByStatus = HISTORY_LABEL_BY_TYPE[documentType] || {};
  const eventRows = [...historyRows]
    .map((row) => ({
      ...row,
      _key: normalizeTrackingStatusKey(documentType, row.status),
    }))
    .filter((row) => row._key)
    .sort((a, b) => {
      const aTime = new Date(a.changedAt || 0).getTime();
      const bTime = new Date(b.changedAt || 0).getTime();
      if (aTime !== bTime) return aTime - bTime;
      return (a.id || 0) - (b.id || 0);
    });

  const timeline = eventRows.map((row) => ({
    status: labelByStatus[row._key] || row.status,
    date: formatDateTimeInLima(row.changedAt),
    done: true,
    note: row.note || null,
  }));

  if (!timeline.some((step) => step.status === "Recepcionado")) {
    timeline.unshift({
      status: "Recepcionado",
      date: formatDateTimeInLima(createdAt),
      done: true,
      note: null,
    });
  }

  let maxCanonicalIndex = -1;
  for (const row of eventRows) {
    if (row._key === OBSERVED_STATUS.key) continue;
    const index = steps.findIndex((step) => step.key === row._key);
    if (index > maxCanonicalIndex) maxCanonicalIndex = index;
  }

  const currentKey = normalizeTrackingStatusKey(documentType, currentStatus);
  if (currentKey && currentKey !== OBSERVED_STATUS.key) {
    const currentIndex = steps.findIndex((step) => step.key === currentKey);
    if (currentIndex > maxCanonicalIndex) maxCanonicalIndex = currentIndex;
  }

  if (maxCanonicalIndex < 0) {
    maxCanonicalIndex = 0;
  }

  const pendingSteps = steps
    .slice(maxCanonicalIndex + 1)
    .map((step) => ({
      status: labelByStatus[step.key] || step.label,
      date: null,
      done: false,
      note: null,
    }));

  return [...timeline, ...pendingSteps];
};

const normalizeCurrentStatusLabel = (documentType, currentStatus) => {
  const key = normalizeTrackingStatusKey(documentType, currentStatus);
  if (!key) return currentStatus;

  if (key === "EnProceso") return "En proceso";

  return OBSERVED_STATUS.key === key ? OBSERVED_STATUS.label : (HISTORY_LABEL_BY_TYPE[documentType]?.[key] || currentStatus);
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
  formatDateInLima,
  buildTrackingResponse,
};
