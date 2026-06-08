const XLSX = require("xlsx");

const toCertificateCode = (value) => {
  if (!value) return "";
  if (/^\d+$/.test(value)) return Number.parseInt(value, 10);
  return value;
};

const pad = (value) => String(value).padStart(2, "0");

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const buildCertificatesWorkbook = (certificates) => {
  const headers = [
    "Código Cert.",
    "Nombres",
    "DNI",
    "Ubicación",
    "Tipo de Terreno",
    "Mz",
    "Lote",
    "Fecha Creación",
    "Estado",
  ];
  const rows = certificates.map((certificate) => [
    toCertificateCode(certificate.certificateNumber),
    (certificate.owners || []).map((owner) => owner.client?.fullName).filter(Boolean).join(", ") || [certificate.client?.fullName, certificate.partner?.fullName].filter(Boolean).join(", "),
    (certificate.owners || []).map((owner) => owner.client?.documentNumber).filter(Boolean).join(", ") || [certificate.client?.documentNumber, certificate.partner?.documentNumber].filter(Boolean).join(", "),
    certificate.sector?.name || "",
    certificate.terrainType?.name || "",
    certificate.mz || "",
    certificate.lot || "",
    formatDateTime(certificate.createdAt),
    certificate.status,
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 38 },
    { wch: 18 },
    { wch: 30 },
    { wch: 22 },
    { wch: 10 },
    { wch: 10 },
    { wch: 20 },
    { wch: 16 },
  ];

  rows.forEach((row, index) => {
    if (typeof row[0] === "number") {
      worksheet[`A${index + 2}`] = { t: "n", v: row[0] };
    }
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Certificados");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

module.exports = {
  buildCertificatesWorkbook,
};
