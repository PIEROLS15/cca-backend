const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const certificatesService = require("../../certificates/services/certificates.service");
const certificateRequestsService = require("../../certificate-requests/services/certificate-requests.service");
const assemblyRecordRequestsService = require("../../assembly-record-requests/services/assembly-record-requests.service");
const { DOCUMENT_TYPES } = require("../../../utils/document-status-history.utils");
const { buildTrackingResponse, formatCertificateRequestTypes } = require("../utils/document-tracking.utils");
const { normalizeComparableText } = require("../../certificate-requests/utils/certificate-request-legacy.utils");

const DOCUMENT_TYPE_ALIASES = {
  certificate: "certificate",
  certificados: "certificate",
  certificado: "certificate",
  certificate_request: "certificate_request",
  certificadorequest: "certificate_request",
  solicitudescertificados: "certificate_request",
  solicituddecertificado: "certificate_request",
  solicitudcertificado: "certificate_request",
  assembly_record_request: "assembly_record_request",
  assemblyrecordrequest: "assembly_record_request",
  solicitudesacta: "assembly_record_request",
  solicituddeacta: "assembly_record_request",
  solicitudacta: "assembly_record_request",
  acta: "assembly_record_request",
};

const normalizeTrackingDocumentType = (value) => {
  const normalized = normalizeComparableText(value);
  return DOCUMENT_TYPE_ALIASES[normalized] || null;
};

const documentLoaders = {
  certificate: {
    historyType: DOCUMENT_TYPES.CERTIFICATE,
    load: (code) => certificatesService.getCertificateByNumber(code),
    codeField: "certificateNumber",
    buildInformation: (document) => ({
      people: (document.owners || []).map((owner) => ({
        role: "Titular",
        fullName: owner.fullName || "",
        documentNumber: owner.documentNumber || "",
      })),
      fields: [
        { label: "Ubicación", value: document.location?.sectors?.name || "" },
        { label: "Tipo de terreno", value: document.terrain?.terrainType?.name || "" },
        { label: "Manzana", value: document.location?.mz || "" },
        { label: "Lote", value: document.location?.lot || "" },
      ],
    }),
  },
  certificate_request: {
    historyType: DOCUMENT_TYPES.CERTIFICATE_REQUEST,
    load: (code) => certificateRequestsService.getCertificateRequestById(code),
    codeField: "requestNumber",
    buildInformation: (document) => ({
      people: [
        {
          role: "Solicitante",
          fullName: document.client?.fullName || "",
          documentNumber: document.client?.documentNumber || "",
        },
        ...(document.partnerClient?.fullName || document.partnerClient?.documentNumber
          ? [{
              role: "Acompañante",
              fullName: document.partnerClient?.fullName || "",
              documentNumber: document.partnerClient?.documentNumber || "",
            }]
          : []),
      ],
      fields: [
        { label: "Descripción", value: document.requestDescription || document.description || "" },
        { label: "Tipo de solicitud", value: formatCertificateRequestTypes(document.certificateTypes) },
        { label: "Sector", value: document.sectorLocation || "" },
        { label: "Destino", value: document.destination || "" },
      ],
    }),
  },
  assembly_record_request: {
    historyType: DOCUMENT_TYPES.ASSEMBLY_RECORD_REQUEST,
    load: async (code) => {
      const certificate = await certificatesService.getCertificateByNumber(code);
      if (!certificate) return null;

      const request = await prisma.assemblyRecordRequest.findFirst({
        where: { certificateId: certificate.id },
        include: {
          client: { include: { commoner: true } },
          certificate: { include: { sector: true, terrainType: true } },
          user: true,
        },
      });

      return request || null;
    },
    getCode: (doc) => doc.certificate?.certificateNumber || doc.code,
    buildInformation: (document) => ({
      people: [
        {
          role: "Comprador",
          fullName: document.buyerFullName || document.client?.fullName || "",
          documentNumber: document.legacyPayload?.buyerDocumentNumber || document.client?.documentNumber || "",
        },
        ...(document.sellerFullName
          ? [{
              role: "Vendedor",
              fullName: document.sellerFullName,
              documentNumber: document.legacyPayload?.sellerDocumentNumber || document.legacyPayload?.sellerDni || "",
            }]
          : []),
      ],
      fields: [
        { label: "Ubicación", value: document.sectorLocation || "" },
        { label: "Tipo de terreno", value: document.terrainType || "" },
        { label: "Fecha de adjudicación", value: document.awardDate || "" },
        { label: "Tiempo de posesión", value: document.possessionTime || "" },
      ],
    }),
  },
};

const getDocumentTrackingByTypeAndCode = async (documentType, code) => {
  const normalizedType = normalizeTrackingDocumentType(documentType);
  const loader = normalizedType ? documentLoaders[normalizedType] : null;

  if (!loader) {
    throw new HttpError(400, "Tipo de documento inválido");
  }

  const document = await loader.load(code);
  if (!document) {
    throw new HttpError(404, "Documento no encontrado");
  }

  const historyRows = await prisma.documentStatusHistory.findMany({
    where: {
      documentType: loader.historyType,
      documentId: document.id,
    },
    orderBy: [{ changedAt: "asc" }, { id: "asc" }],
  });

  const getCode = loader.getCode || ((doc) => doc[loader.codeField]);
  const docCode = getCode(document);

  return buildTrackingResponse({
    documentType: normalizedType,
    code: docCode,
    currentStatus: document.status,
    createdAt: document.createdAt,
    information: loader.buildInformation(document),
    historyRows,
  });
};

module.exports = {
  getDocumentTrackingByTypeAndCode,
};
