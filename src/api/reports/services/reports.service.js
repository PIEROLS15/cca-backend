const prisma = require("../../../config/prisma");
const { buildCertificateFilters } = require("../../certificates/utils/certificates.utils");
const { buildCertificatesWorkbook } = require("../utils/reports.utils");

const exportCertificatesReport = async (query) => {
  const where = buildCertificateFilters(query);

  const certificates = await prisma.certificate.findMany({
    where,
    include: {
      client: true,
      partner: true,
      sector: true,
      terrainType: true,
    },
    orderBy: { certificateNumber: "desc" },
  });

  return buildCertificatesWorkbook(certificates);
};

module.exports = {
  exportCertificatesReport,
};
