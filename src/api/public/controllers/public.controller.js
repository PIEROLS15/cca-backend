const asyncHandler = require("../../../utils/async-handler");
const { sendSuccess } = require("../../../utils/api-response");
const certificatesService = require("../../certificates/services/certificates.service");
const documentTrackingService = require("../services/document-tracking.service");

const verifyCertificate = asyncHandler(async (req, res) => {
  const data = await certificatesService.getCertificateVerificationByToken(req.params.token);
  return sendSuccess(res, {
    message: "Certificado verificado correctamente",
    data,
  });
});

const trackDocument = asyncHandler(async (req, res) => {
  const data = await documentTrackingService.getDocumentTrackingByTypeAndCode(
    req.params.documentType,
    req.params.code,
  );

  return sendSuccess(res, {
    message: "Documento consultado correctamente",
    data,
  });
});

module.exports = {
  verifyCertificate,
  trackDocument,
};
