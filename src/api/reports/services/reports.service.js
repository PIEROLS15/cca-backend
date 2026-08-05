const prisma = require("../../../config/prisma");
const { buildCertificateFilters } = require("../../certificates/utils/certificates.utils");
const commonerLicensesService = require("../../commoner-licenses/services/commoner-licenses.service");
const { buildCertificatesWorkbook, buildCommonerLicensesWorkbook } = require("../utils/reports.utils");

const exportCertificatesReport = async (query) => {
  const where = buildCertificateFilters(query);

  const certificates = await prisma.certificate.findMany({
    where,
    include: {
      client: true,
      partner: true,
      owners: { include: { client: true }, orderBy: { order: "asc" } },
      sector: true,
      terrainType: true,
    },
    orderBy: [
      { createdAt: "desc" },
      { certificateNumber: "desc" },
    ],
  });

  return buildCertificatesWorkbook(certificates);
};

const exportCommonerLicensesReport = async (query) => {
  const licenses = await commonerLicensesService.listAllCommonerLicensesForReport({
    search: query.search,
    status: query.status,
  });

  return buildCommonerLicensesWorkbook(licenses);
};

module.exports = {
  exportCertificatesReport,
  exportCommonerLicensesReport,
};
