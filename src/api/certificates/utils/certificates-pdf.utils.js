const { createPdfWithBarcode } = require("../../../utils/pdf-with-barcode");

const buildCertificatePdf = async (certificate) => {
  const ownerList = [];
  if (certificate.owners) {
    certificate.owners.forEach((o) => ownerList.push(`${o.fullName} (${o.documentNumber})`));
  }
  const fields = [
    { label: "Numero de Certificado", value: certificate.certificateNumber },
    { label: "Estado", value: certificate.status },
    { label: "Propietarios", value: ownerList || "" },
    { label: "Sector", value: certificate.location?.sectors?.name || "" },
    { label: "Tipo de Terreno", value: certificate.terrain?.terrainType?.name || "" },
    { label: "Mz", value: certificate.location?.mz || "" },
    { label: "Lote", value: certificate.location?.lot || "" },
    { label: "Ancho", value: certificate.terrain?.width != null ? `${certificate.terrain.width} m` : "" },
    { label: "Largo", value: certificate.terrain?.length != null ? `${certificate.terrain.length} m` : "" },
    { label: "Area Total", value: certificate.terrain?.totalArea != null ? `${certificate.terrain.totalArea} m²` : "" },
    { label: "Norte", value: certificate.borders?.north || "" },
    { label: "Sur", value: certificate.borders?.south || "" },
    { label: "Este", value: certificate.borders?.east || "" },
    { label: "Oeste", value: certificate.borders?.west || "" },
  ];

  return createPdfWithBarcode({
    title: "Certificado Comunal",
    subtitle: "Comunidad Campesina de Asia",
    fields,
    barcodeValue: certificate.certificateNumber,
    footer: "Documento generado por el sistema de gestion comunal",
  });
};

module.exports = {
  buildCertificatePdf,
};
