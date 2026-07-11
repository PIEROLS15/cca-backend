const DOCUMENT_TYPES = {
  CERTIFICATE: "certificate",
  CERTIFICATE_REQUEST: "certificate_request",
  ASSEMBLY_RECORD_REQUEST: "assembly_record_request",
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

module.exports = {
  DOCUMENT_TYPES,
  recordDocumentStatusHistory,
};
