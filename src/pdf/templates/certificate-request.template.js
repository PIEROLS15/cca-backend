const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const LOGO_FILENAME = "logo-comunidad-campesina-asia.png";

const LOGO_CANDIDATE_PATHS = [
  path.resolve(__dirname, "..", "..", "assets", LOGO_FILENAME),
  path.resolve(__dirname, "..", "..", "assets", "logo-comunidad-campesina-asia.PNG"),
  path.resolve(process.cwd(), "src", "assets", LOGO_FILENAME),
  path.resolve(process.cwd(), "src", "assets", "logo-comunidad-campesina-asia.PNG"),
  path.resolve(process.cwd(), "assets", LOGO_FILENAME),
  path.resolve(process.cwd(), "assets", "logo-comunidad-campesina-asia.PNG"),
  path.resolve(process.cwd(), LOGO_FILENAME),
  path.resolve(process.cwd(), "logo-comunidad-campesina-asia.PNG"),
];

const YEAR_TEXT = '"Año de la recuperación y consolidación de la economía peruana"';
const CUSTOMER_CARE_TEXT = "Numero de atencion al cliente 01 641 3577";

const resolveLogoPath = () => LOGO_CANDIDATE_PATHS.find((candidate) => fs.existsSync(candidate));

const normalizeToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]/g, "");

const toDisplayDate = (value) => {
  const date = value ? new Date(value) : new Date();
  const monthNames = [
    "ENERO",
    "FEBRERO",
    "MARZO",
    "ABRIL",
    "MAYO",
    "JUNIO",
    "JULIO",
    "AGOSTO",
    "SETIEMBRE",
    "OCTUBRE",
    "NOVIEMBRE",
    "DICIEMBRE",
  ];

  return `ASIA ${date.getDate()} DE ${monthNames[date.getMonth()]} DEL ${date.getFullYear()}`;
};

const isSelectedType = (types, key) =>
  types.some((item) => normalizeToken(item.type) === normalizeToken(key));

const findOtherTypeLabel = (types) => {
  const found = types.find((item) => normalizeToken(item.type) === normalizeToken("Otros"));
  return found?.otherType || "";
};

const findAttachment = (attachments, key) =>
  attachments.find((item) => normalizeToken(item.type) === normalizeToken(key));

const mark = (selected) => (selected ? "( X )" : "(   )");

const toHeaderRequestNumber = (requestNumber) => {
  const raw = String(requestNumber || "").trim();
  if (!raw) {
    return "-";
  }

  const numericBlock = raw.split("-")[0].trim();
  return numericBlock || raw;
};

const drawAttachmentLine = (doc, marker, label) => {
  const markerX = 52;
  const labelX = 92;
  const y = doc.y;

  doc.text(marker, markerX, y, { width: 34, align: "left", lineGap: 0 });
  doc.text(label, labelX, y, { width: 430, align: "left", lineGap: 0 });
  doc.moveDown(0.06);
};

const buildCertificateRequestTemplatePdf = async (request) => {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks = [];

  const certificateTypes = Array.isArray(request.certificateTypes) ? request.certificateTypes : [];
  const attachments = Array.isArray(request.attachments) ? request.attachments : [];
  const partner = request.partnerClient || {};
  const client = request.client || {};

  const certificateChecked = isSelectedType(certificateTypes, "CertificadoPosesion");
  const planoChecked = isSelectedType(certificateTypes, "PlanoMemoria");
  const otherChecked = isSelectedType(certificateTypes, "Otros");
  const otherLabel = findOtherTypeLabel(certificateTypes);

  const copyCertAttachment = Boolean(findAttachment(attachments, "CopiaCertificadoAnterior"));
  const copyDniAttachment = Boolean(findAttachment(attachments, "CopiaDni"));
  const contractAttachment = Boolean(findAttachment(attachments, "ContratoCompraVentaNotariado"));
  const planoAttachment = Boolean(findAttachment(attachments, "CopiaPlanoMemoria"));
  const cellAttachment = findAttachment(attachments, "Celular");

  return new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      const logoPath = resolveLogoPath();
      if (logoPath) {
        doc.image(logoPath, 42, 20, { fit: [158, 54] });
      }

      doc.font("Times-Roman").fontSize(12).text(YEAR_TEXT, 282, 26, {
        align: "center",
        width: 260,
      });

      const requestNumber = toHeaderRequestNumber(request.requestNumber);
      const headerTitle = request.isComunero
        ? `N°${requestNumber} - SOLICITUD COMUNERO`
        : `N°${requestNumber} - SOLICITUD NO COMUNERO`;

      doc.font("Times-Bold").fontSize(13.8).text(headerTitle, 50, 84, {
        width: 492,
        align: "center",
        underline: true,
      });

      doc.font("Times-Roman").fontSize(11.2).text(toDisplayDate(request.createdAt), 50, 124, {
        width: 492,
        align: "right",
      });

      doc.y = 170;
      doc.font("Times-Roman").fontSize(11.8).text("SOLICITO, TRASPASO", 52, doc.y, { lineGap: 0 });
      doc.moveDown(0.88);

      const optionsY = doc.y;
      doc.text(`CERTIFICADO DE POSESION ${mark(certificateChecked)}`, 52, optionsY, { width: 240, lineGap: 0 });
      doc.text(`PLANO Y MEMORIA ${mark(planoChecked)}`, 296, optionsY, { width: 190, lineGap: 0 });
      doc.text(`OTROS ${mark(otherChecked)}`, 448, optionsY, { width: 96, lineGap: 0, align: "left" });
      doc.y = optionsY + doc.currentLineHeight(true) + 6;

      if (otherChecked && otherLabel) {
        doc.fontSize(11.2).text(otherLabel, 52, doc.y, { width: 492, lineGap: 0 });
        doc.moveDown(0.7);
      }

      doc.fontSize(11.8).text(`ANEXO O SECTOR: ${request.sectorLocation || ""}`, 52, doc.y, {
        width: 492,
        lineGap: 0,
      });
      doc.moveDown(1.75);

      doc.font("Times-Bold").fontSize(12.4).text("SR. ALFREDO ENRIQUE GARCIA PENAS", 52, doc.y, {
        width: 492,
        lineGap: 0,
      });
      doc.font("Times-Roman");
      doc.text("PRESIDENTE DE LA COMUNIDAD CAMPESINA DE ASIA", 52, doc.y, { width: 492, lineGap: 0 });
      doc.moveDown(1.1);

      doc.font("Times-Roman").fontSize(11.4);

      const partnerLine =
        partner.fullName || partner.documentNumber
          ? ` Casado(a) o conviviente con ${partner.fullName || ""}, DNI: ${partner.documentNumber || ""}`
          : "";

      const intro = `Yo, ${client.fullName || ""}, identificado con DNI Nro. ${client.documentNumber || ""}, domiciliado en el anexo ${client.address || ""}.${partnerLine}`;
      doc.text(intro, 52, doc.y, { width: 492, align: "left", lineGap: 0 });
      doc.moveDown(1.35);

      doc.text("Ante usted me presento y expongo:", 52, doc.y, { width: 492, lineGap: 0 });
      doc.moveDown(0.45);

      doc.font("Times-Roman").text(request.exposure || request.requestDescription || "", 52, doc.y, {
        width: 492,
        align: "left",
        lineGap: 0,
      });
      doc.moveDown(1.05);

      doc.font("Times-Roman").text(
        "Sin otro particular me despido de usted no sin antes reiterarle mi estima personal.",
        52,
        doc.y,
        { width: 492, lineGap: 0 }
      );
      doc.moveDown(1.8);

      doc.text("Atentamente", 52, doc.y, { width: 492, align: "center", lineGap: 0 });
      doc.moveDown(1.45);
      doc.text(".....................................", 52, doc.y, { width: 492, align: "center", lineGap: 0 });
      doc.moveDown(0.22);
      doc.text(`DNI: ${client.documentNumber || ""}`, 52, doc.y, { width: 492, align: "center", lineGap: 0 });
      doc.moveDown(1.35);

      doc.text("Adjunto:", 52, doc.y, { width: 492, lineGap: 0 });
      doc.moveDown(0.65);
      drawAttachmentLine(doc, mark(copyCertAttachment), "Copia de Certificado anterior");
      drawAttachmentLine(doc, mark(copyDniAttachment), "Copia de DNI");
      drawAttachmentLine(doc, mark(contractAttachment), "Contrato de compra-venta notariado");
      drawAttachmentLine(doc, mark(planoAttachment), "Copia de plano y memoria");
      drawAttachmentLine(doc, mark(Boolean(cellAttachment)), `Celular Nro. ${cellAttachment?.phoneNumber || ""}`);

      doc.moveDown(0.55);
      doc.font("Times-Bold").fontSize(10.8).text(CUSTOMER_CARE_TEXT, 52, doc.y, {
        width: 492,
        align: "right",
        lineGap: 0,
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  buildCertificateRequestTemplatePdf,
};
