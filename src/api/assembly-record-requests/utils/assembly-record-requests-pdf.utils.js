const { buildPdfFromTemplate } = require("../../../pdf/templates");

const buildAssemblyRecordRequestPdf = async (request) => {
  return buildPdfFromTemplate("assembly-record-request", request);
};

module.exports = {
  buildAssemblyRecordRequestPdf,
};
