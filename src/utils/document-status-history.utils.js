const DOCUMENT_TYPES = {
  CERTIFICATE: "certificate",
  CERTIFICATE_REQUEST: "certificate_request",
  ASSEMBLY_RECORD_REQUEST: "assembly_record_request",
};

const CANONICAL_STATUS_ORDER = ["Recepcionado", "PorFirmar", "PorRecoger", "Entregado"];

const getCanonicalStatusRank = (value) => {
  const normalized = String(value || "").trim();
  return CANONICAL_STATUS_ORDER.findIndex((status) => status === normalized);
};

const getCurrentCanonicalStatusRank = (historyRows = [], currentStatus = null) => {
  let maxRank = -1;
  for (const row of historyRows) {
    const rank = getCanonicalStatusRank(row.status);
    if (rank > maxRank) maxRank = rank;
  }

  if (maxRank >= 0) return maxRank;

  const directRank = getCanonicalStatusRank(currentStatus);
  if (directRank >= 0) return directRank;

  return maxRank;
};

const clearLaterDocumentStatusHistory = async (tx, {
  documentType,
  documentId,
  targetStatus,
  historyRows = [],
}) => {
  const targetRank = getCanonicalStatusRank(targetStatus);
  if (targetRank < 0) return false;

  if (targetRank === 0) {
    const deleted = await tx.documentStatusHistory.deleteMany({
      where: {
        documentType,
        documentId,
        NOT: { status: "Recepcionado" },
      },
    });

    return deleted.count > 0;
  }

  const anchor = targetRank === 0
    ? historyRows[0]
    : historyRows.find((row) => getCanonicalStatusRank(row.status) > targetRank);

  if (!anchor) return false;

  await tx.documentStatusHistory.deleteMany({
    where: {
      documentType,
      documentId,
      OR: [
        { changedAt: { gt: anchor.changedAt } },
        { changedAt: anchor.changedAt, id: { gt: anchor.id } },
      ],
    },
  });

  return true;
};

const recordDocumentStatusHistory = (tx, {
  documentType,
  documentId,
  status,
  changedByUserId = null,
  changedAt = null,
  note = null,
}) => tx.documentStatusHistory.create({
  data: {
    documentType,
    documentId,
    status,
    changedByUserId,
    changedAt: changedAt || undefined,
    note,
  },
});

const getLatestObservationNotes = async (prisma, documentType, documentIds = []) => {
  const ids = [...new Set((documentIds || []).map((id) => Number(id)).filter(Number.isFinite))];
  if (ids.length === 0) return new Map();

  const rows = await prisma.documentStatusHistory.findMany({
    where: {
      documentType,
      documentId: { in: ids },
      status: "Observado",
    },
    orderBy: [{ changedAt: "desc" }, { id: "desc" }],
    select: {
      documentId: true,
      note: true,
    },
  });

  const notes = new Map();
  for (const row of rows) {
    if (!notes.has(row.documentId)) {
      notes.set(row.documentId, row.note || null);
    }
  }

  return notes;
};

module.exports = {
  DOCUMENT_TYPES,
  CANONICAL_STATUS_ORDER,
  getCanonicalStatusRank,
  getCurrentCanonicalStatusRank,
  clearLaterDocumentStatusHistory,
  recordDocumentStatusHistory,
  getLatestObservationNotes,
};
