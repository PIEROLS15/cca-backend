const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildCertificateFilters } = require("../../certificates/utils/certificates.utils");
const { normalizeSearchTerm } = require("../../commoner-licenses/utils/commoner-licenses.utils");
const { buildCertificatesWorkbook, buildCommonerLicensesWorkbook } = require("../utils/reports.utils");

const VALID_COMMONER_LICENSE_STATUSES = ["Sin entregar", "Entregado"];

const buildCommonerLicenseReportWhere = ({ search, status } = {}) => {
  const where = {};
  const term = normalizeSearchTerm(search);

  if (term) {
    where.OR = [
      { dni: { contains: term, mode: "insensitive" } },
      { licenseNumber: { contains: term, mode: "insensitive" } },
      { fullName: { contains: term, mode: "insensitive" } },
      { firstNames: { contains: term, mode: "insensitive" } },
      { lastNames: { contains: term, mode: "insensitive" } },
    ];
  }

  if (status) {
    if (!VALID_COMMONER_LICENSE_STATUSES.includes(status)) {
      throw new HttpError(400, `Estado invalido. Valores permitidos: ${VALID_COMMONER_LICENSE_STATUSES.join(", ")}`);
    }

    where.status = status;
  }

  return where;
};

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
  const where = buildCommonerLicenseReportWhere({
    search: query.search,
    status: query.status,
  });

  const licenses = await prisma.commonerLicense.findMany({
    where,
    orderBy: [{ licenseNumber: "asc" }, { id: "asc" }],
  });

  return buildCommonerLicensesWorkbook(licenses);
};

module.exports = {
  exportCertificatesReport,
  exportCommonerLicensesReport,
};
