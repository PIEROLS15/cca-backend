const asyncHandler = require("../../../utils/async-handler");
const { sendSuccess } = require("../../../utils/api-response");
const certificatesService = require("../../certificates/services/certificates.service");

const verifyCertificate = asyncHandler(async (req, res) => {
  const data = await certificatesService.getCertificateVerificationByToken(req.params.token);
  return sendSuccess(res, {
    message: "Certificado verificado correctamente",
    data,
  });
});

module.exports = {
  verifyCertificate,
};
