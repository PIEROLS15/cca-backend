const XLSX = require("xlsx");

const buildCertificatesWorkbook = (certificates) => {
  const rows = certificates.map((certificate) => ({
    NumeroCertificado: certificate.certificateNumber,
    Estado: certificate.status,
    Propietarios: [certificate.client?.fullName, certificate.partner?.fullName].filter(Boolean).join(", "),
    Documentos: [certificate.client?.documentNumber, certificate.partner?.documentNumber].filter(Boolean).join(", "),
    Sector: certificate.sector?.name || "",
    TipoTerreno: certificate.terrainType?.name || "",
    Mz: certificate.mz || "",
    Lote: certificate.lot || "",
    Ancho: certificate.width ? Number(certificate.width) : "",
    Largo: certificate.length ? Number(certificate.length) : "",
    AreaTotal: certificate.totalArea ? Number(certificate.totalArea) : "",
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
