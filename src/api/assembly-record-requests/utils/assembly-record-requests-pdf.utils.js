const { createPdfWithBarcode } = require("../../../utils/pdf-with-barcode");

const buildAssemblyRecordRequestPdf = async (request) => {
  const fields = [
    { label: "Codigo", value: request.code },
    { label: "Estado", value: request.status },
    { label: "Cliente", value: request.client?.fullName },
    { label: "Documento", value: request.client?.documentNumber },
    { label: "Certificado asociado", value: request.certificate?.certificateNumber },
    { label: "Usuario", value: request.user?.fullName },
    { label: "Descripcion", value: request.description },
    { label: "Fecha de registro", value: request.createdAt },
  ];

  return createPdfWithBarcode({
    title: "Solicitud de Acta de Asamblea",
    subtitle: "Comunidad Campesina de Asia",
    fields,
    barcodeValue: request.code,
    footer: "Documento generado por el sistema de gestion comunal",
  });
};

module.exports = {
  buildAssemblyRecordRequestPdf,
};
