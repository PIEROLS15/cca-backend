const { buildCertificateRequestTemplatePdf } = require("./certificate-request.template");
const { buildCertificatePdf } = require("./certificate.template");
const { buildAssemblyRecordRequestTemplatePdf } = require("./assembly-record-request.template");

const buildPdfFromTemplate = async (templateName, payload) => {
  if (templateName === "certificate-request") {
    return buildCertificateRequestTemplatePdf(payload);
  }

  if (templateName === "certificate") {
    return buildCertificatePdf(payload);
  }

  if (templateName === "assembly-record-request") {
    return buildAssemblyRecordRequestTemplatePdf(payload);
  }

  throw new Error(`Plantilla PDF no soportada: ${templateName}`);
};

module.exports = {
  buildPdfFromTemplate,
};
