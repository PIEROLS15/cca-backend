const { buildPdfFromTemplate } = require("../../../pdf/templates");

const buildCertificateRequestPdf = async (request) => {
  return buildPdfFromTemplate("certificate-request", request);
};

module.exports = {
  buildCertificateRequestPdf,
};
