const { buildPdfFromTemplate } = require("../../../pdf/templates");

const buildCertificatePdf = async (certificate) => {
  return buildPdfFromTemplate("certificate", certificate);
};

module.exports = {
  buildCertificatePdf,
};
