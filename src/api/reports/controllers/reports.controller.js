const asyncHandler = require("../../../utils/async-handler");
const reportsService = require("../services/reports.service");

const exportCertificatesReport = asyncHandler(async (req, res) => {
  const fileBuffer = await reportsService.exportCertificatesReport(req.query);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", 'attachment; filename="reporte-certificados.xlsx"');
  res.send(fileBuffer);
});

const exportCommonerLicensesReport = asyncHandler(async (req, res) => {
  const fileBuffer = await reportsService.exportCommonerLicensesReport(req.query);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", 'attachment; filename="reporte-carnets.xlsx"');
  res.send(fileBuffer);
});

module.exports = {
  exportCertificatesReport,
  exportCommonerLicensesReport,
};
