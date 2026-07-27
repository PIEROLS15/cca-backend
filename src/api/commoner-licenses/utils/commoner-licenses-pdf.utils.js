const { buildPdfFromTemplate } = require("../../../pdf/templates");

const buildCommonerLicensePdf = async (license) => {
  return buildPdfFromTemplate("commoner-license", license);
};

module.exports = {
  buildCommonerLicensePdf,
};
