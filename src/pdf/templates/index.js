const { buildCertificateRequestTemplatePdf } = require("./certificate-request.template");

const buildPdfFromTemplate = async (templateName, payload) => {
  if (templateName === "certificate-request") {
    return buildCertificateRequestTemplatePdf(payload);
  }

  throw new Error(`Plantilla PDF no soportada: ${templateName}`);
};

module.exports = {
  buildPdfFromTemplate,
};
