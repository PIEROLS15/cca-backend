const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const bwipjs = require("bwip-js");

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

const toQrBuffer = (value) =>
  new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      { bcid: "qrcode", text: String(value), scale: 6 },
      (error, png) => (error ? reject(error) : resolve(png))
    );
  });

const buildTrackingUrl = (code) => {
  const trackingUrl = String(process.env.TRACKING_FRONTEND_URL || "http://localhost:9002").replace(/\/$/, "");
  return `${trackingUrl}/?type=solicitud&code=${encodeURIComponent(code)}&tab=history`;
};

const normalizeToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]/g, "");

const toUpperDisplay = (value) => String(value ?? "").toUpperCase();

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

const isSelectedAttachment = (attachments, keys) => {
  const expectedKeys = Array.isArray(keys) ? keys : [keys];
  return attachments.some((item) => expectedKeys.some((key) => normalizeToken(item.type) === normalizeToken(key)));
};

const findOtherTypeLabel = (types) => {
  const found = types.find((item) => normalizeToken(item.type) === normalizeToken("Otros"));
  return found?.otherType || "";
};

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
  doc.moveDown(0.01);
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

  const copyCertAttachment = isSelectedAttachment(attachments, ["CertAnterior", "CopiaCertificadoAnterior"]);
  const copyDniAttachment = isSelectedAttachment(attachments, ["CopiaDni", "CopiaDeDni"]);
  const contractAttachment = isSelectedAttachment(attachments, ["CompraVenta", "ContratoCompraVentaNotariado", "ContratoDeCompraVentaNotariado"]);
  const planoAttachment = isSelectedAttachment(attachments, ["CopiaPlanoMemoria", "PlanoMemoria", "CopiaDePlanoYMemoria"]);
  const constanciaAdjudicacionAttachment = isSelectedAttachment(attachments, ["ConstanciaAdjudicacion", "ConstanciaDeAdjudicacion"]);
  const testimonioAttachment = isSelectedAttachment(attachments, ["Testimonio", "TestimonioDeAdjudicacion", "Testimonio de adjudicacion"]);
  const cellAttachment = attachments.find((item) => normalizeToken(item.type) === normalizeToken("Celular"));

  return new Promise(async (resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      const logoPath = resolveLogoPath();
      if (logoPath) {
        doc.image(logoPath, 42, 20, { fit: [158, 54] });
      }

      doc.font("Times-Roman").fontSize(14).text(YEAR_TEXT, 270, 26, {
        align: "center",
        width: 280,
      });

      const requestNumber = toHeaderRequestNumber(request.requestNumber);
      const headerTitle = request.isComunero
        ? `N°${requestNumber} - SOLICITUD COMUNERO`
        : `N°${requestNumber} - SOLICITUD NO COMUNERO`;

      doc.font("Times-Bold").fontSize(16).text(headerTitle, 50, 92, {
        width: 492,
        align: "center",
        underline: true,
      });

      doc.font("Times-Roman").fontSize(12).text(toDisplayDate(request.createdAt), 50, 132, {
        width: 492,
        align: "right",
      });

      doc.y = 156;
      doc.font("Times-Roman").fontSize(12).text(`SOLICITO, ${toUpperDisplay(request.requestDescription || request.description || "")}`, 52, doc.y, { lineGap: 0 });
      doc.moveDown(0.55);

      const optionsY = doc.y;
      doc.text(`CERTIFICADO DE POSESION ${mark(certificateChecked)}`, 52, optionsY, { width: 240, lineGap: 0 });
      doc.text(`PLANO Y MEMORIA ${mark(planoChecked)}`, 325, optionsY, { width: 190, lineGap: 0 });
      doc.text(`OTROS ${mark(otherChecked)}`, 498, optionsY, { width: 80, lineGap: 0, align: "left" });
      doc.y = optionsY + doc.currentLineHeight(true) + 4;

      if (otherChecked && otherLabel) {
        doc.fontSize(12).text(toUpperDisplay(otherLabel), 52, doc.y, { width: 492, lineGap: 0 });
        doc.moveDown(0.35);
      }
      doc.moveDown(0.8);

      doc.fontSize(12).text(`ANEXO O SECTOR: ${toUpperDisplay(request.sectorLocation)}`, 52, doc.y, {
        width: 492,
        lineGap: 0,
      });
      doc.moveDown(1.6);

      doc.font("Times-Bold").fontSize(12).text("SR. ALFREDO ENRIQUE GARCIA PENAS", 52, doc.y, {
        width: 492,
        lineGap: 0,
        characterSpacing: 0.2,
      });
      doc.font("Times-Roman").fontSize(12);
      doc.text("PRESIDENTE DE LA COMUNIDAD CAMPESINA DE ASIA", 52, doc.y, { width: 492, lineGap: 0 });
      doc.moveDown(0.65);

      doc.font("Times-Roman").fontSize(12);

      const partnerLine =
        partner.fullName || partner.documentNumber
          ? ` Casado(a) o conviviente con ${toUpperDisplay(partner.fullName)}, DNI / CÓDIGO: ${toUpperDisplay(partner.documentNumber)}`
          : "";

      const intro = `Yo, ${toUpperDisplay(client.fullName)}, identificado con DNI / CÓDIGO N° ${toUpperDisplay(client.documentNumber)}, domiciliado en el anexo ${toUpperDisplay(client.address)}.${partnerLine}`;
      doc.text(intro, 52, doc.y, { width: 470, align: "justify", lineGap: 0 });
      doc.moveDown(1.2);

      doc.text("Ante usted me presento y expongo:", 52, doc.y, { width: 492, lineGap: 0 });
      doc.moveDown(0.08);

      doc.font("Times-Roman").text(toUpperDisplay(request.exposure || ""), 52, doc.y, {
        width: 470,
        align: "left",
        lineGap: 0,
      });
      doc.moveDown(1.1);

      doc.font("Times-Roman").text(
        "Sin otro particular me despido de usted no sin antes reiterarle mi estima personal.",
        52,
        doc.y,
        { width: 492, lineGap: 0 }
      );
      doc.moveDown(1.6);

      doc.text("Atentamente", 52, doc.y, { width: 492, align: "center", lineGap: 0 });
      doc.moveDown(2.75);
      doc.text("................................................", 52, doc.y, {
        width: 492,
        align: "center",
        lineGap: 0,
      });
      doc.moveDown(0.08);
      doc.text(`DNI / CÓDIGO: ${toUpperDisplay(client.documentNumber)}`, 52, doc.y, {
        width: 492,
        align: "center",
        lineGap: 0,
      });
      doc.moveDown(1.2);

      doc.text("Adjunto:", 52, doc.y, { width: 492, lineGap: 0 });
      doc.moveDown(0.65);
      doc.fontSize(12);
      drawAttachmentLine(doc, mark(copyCertAttachment), "Copia de Certificado anterior");
      drawAttachmentLine(doc, mark(copyDniAttachment), "Copia de DNI");
      drawAttachmentLine(doc, mark(contractAttachment), "Contrato de compra-venta notariado");
      drawAttachmentLine(doc, mark(planoAttachment), "Copia de plano y memoria");
      drawAttachmentLine(doc, mark(constanciaAdjudicacionAttachment), "Constancia de adjudicación");
      drawAttachmentLine(doc, mark(testimonioAttachment), "Testimonio");
      drawAttachmentLine(doc, mark(Boolean(cellAttachment)), `Celular Nro. ${toUpperDisplay(cellAttachment?.phoneNumber)}`);

      doc.moveDown(0.8);

      const qrSize = 80;
      const qrX = 462;
      const qrY = doc.y;
      const trackingUrl = buildTrackingUrl(request.requestNumber);
      const qrBuffer = await toQrBuffer(trackingUrl);
      doc.image(qrBuffer, qrX, qrY, { fit: [qrSize, qrSize] });

      const customerCareY = qrY + qrSize + 8;
      doc.font("Times-Bold").fontSize(12).text(CUSTOMER_CARE_TEXT, 52, customerCareY, {
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
