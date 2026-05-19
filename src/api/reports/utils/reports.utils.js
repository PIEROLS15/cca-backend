const XLSX = require("xlsx");

const buildCertificatesWorkbook = (certificates) => {
  const rows = certificates.map((certificate) => ({
    Codigo: certificate.code,
    Correlativo: certificate.correlative,
    Estado: certificate.status,
    Cliente: certificate.client?.fullName || "",
    Documento: certificate.client?.documentNumber || "",
    Ubicacion: certificate.location || "",
    Mz: certificate.mz || "",
    Lote: certificate.lot || "",
    CodigoSolicitud: certificate.request?.code || "",
    FechaCreacion: certificate.createdAt,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Certificados");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

module.exports = {
  buildCertificatesWorkbook,
};
