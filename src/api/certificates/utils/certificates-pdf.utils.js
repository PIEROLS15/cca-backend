const { createPdfWithBarcode } = require("../../../utils/pdf-with-barcode");

const buildCertificatePdf = async (certificate) => {
  const fields = [
    { label: "Codigo", value: certificate.code },
    { label: "Correlativo", value: certificate.correlative },
    { label: "Estado", value: certificate.status },
    { label: "Cliente", value: certificate.client?.fullName },
    { label: "Documento", value: certificate.client?.documentNumber },
    { label: "Sector", value: certificate.sector?.name },
    { label: "Tipo de terreno", value: certificate.terrainType?.name },
    { label: "Ubicacion", value: certificate.location },
    { label: "Mz", value: certificate.mz },
    { label: "Lote", value: certificate.lot },
    { label: "Codigo de solicitud", value: certificate.request?.code },
  ];

  return createPdfWithBarcode({
    title: "Certificado Comunal",
    subtitle: "Comunidad Campesina de Asia",
    fields,
    barcodeValue: certificate.code,
    footer: "Documento generado por el sistema de gestion comunal",
  });
};

module.exports = {
  buildCertificatePdf,
};
