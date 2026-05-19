const prisma = require("../../../config/prisma");
const { buildCertificateFilters } = require("../../certificates/utils/certificates.utils");
const { buildCertificatesWorkbook } = require("../utils/reports.utils");

const exportCertificatesReport = async (query) => {
  const where = buildCertificateFilters(query);

  const certificates = await prisma.certificate.findMany({
    where,
    include: {
      client: true,
      request: true,
    },
    orderBy: { id: "desc" },
  });

  return buildCertificatesWorkbook(certificates);
};

module.exports = {
  exportCertificatesReport,
};
