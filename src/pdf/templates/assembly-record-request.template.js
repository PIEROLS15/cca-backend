const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const bwipjs = require("bwip-js");

const LOGO_FILENAME = "logo-comunidad-campesina-asia.png";

const LOGO_CANDIDATE_PATHS = [
  path.resolve(__dirname, "..", "assets", LOGO_FILENAME),
  path.resolve(__dirname, "..", "assets", "logo-comunidad-campesina-asia.PNG"),
  path.resolve(process.cwd(), "src", "assets", LOGO_FILENAME),
  path.resolve(process.cwd(), "src", "assets", "logo-comunidad-campesina-asia.PNG"),
  path.resolve(process.cwd(), "assets", LOGO_FILENAME),
  path.resolve(process.cwd(), "assets", "logo-comunidad-campesina-asia.PNG"),
  path.resolve(process.cwd(), LOGO_FILENAME),
  path.resolve(process.cwd(), "logo-comunidad-campesina-asia.PNG"),
];

const resolveLogoPath = () => LOGO_CANDIDATE_PATHS.find((candidate) => fs.existsSync(candidate));

const toQrBuffer = (value) =>
  new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      { bcid: "qrcode", text: String(value), scale: 6 },
      (error, png) => (error ? reject(error) : resolve(png))
    );
  });

const buildTrackingUrl = (certificateNumber) => {
  const trackingUrl = String(process.env.TRACKING_FRONTEND_URL || "http://localhost:9002").replace(/\/$/, "");
  return `${trackingUrl}/?type=acta&code=${encodeURIComponent(certificateNumber)}&tab=history`;
};

const toUpperDisplay = (value) => String(value ?? "").toUpperCase();

const toIsoDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
};

const toDecimalText = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(value);
  return Number.isNaN(numeric) ? String(value) : numeric.toFixed(2);
};

const drawLineText = (doc, label, value, x, width, options = {}) => {
  const text = `${label}${value ? `: ${value}` : ":"}`;
  doc.font(options.font || "Times-Roman").fontSize(options.size || 12).text(text, x, doc.y, {
    width,
    align: options.align || "left",
    lineGap: 0,
  });
  if (!options.skipGap) {
    doc.moveDown(options.down || 0.85);
  }
};

const drawAttachmentLine = (doc, checked, label, x, width) => {
  doc.font("Times-Roman").fontSize(11).text(`( ${checked ? "X" : " "} ) ${label}`, x, doc.y, {
    width,
    lineGap: 0,
  });
  doc.moveDown(0.18);
};

const isComunero = (value) => String(value || "").trim().toLowerCase() === "comunero";

const buildAssemblyRecordRequestTemplatePdf = async (request) => {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks = [];

  const client = request.client || {};
  const certificate = request.certificate || {};
  const comuneroFlag = isComunero(request.typeUser);
  const attachments = Array.isArray(request.attachments) ? request.attachments : [];
  const attachmentTypes = new Set(attachments.map((item) => String(item?.type || "").trim()));

  const widthValue = certificate.width ?? null;
  const lengthValue = certificate.length ?? null;
  const totalAreaValue = certificate.area ?? certificate.totalArea ?? null;
  const awardDateValue = toIsoDate(request.awardDate);

  return new Promise(async (resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      const logoPath = resolveLogoPath();

      if (logoPath) {
        doc.image(logoPath, 40, 16, { fit: [210, 74] });
      }

      doc.font("Times-Roman").fontSize(13).text(
        '"Año de la recuperación y consolidación de la economía peruana"',
        285,
        24,
        { align: "center", width: 250 }
      );

      doc.font("Times-Bold").fontSize(17).text("SOLICITUD PARA ACTA DE ASAMBLEA", 50, 105, {
        width: 492,
        align: "center",
        underline: true,
      });

      const leftX = 56;
      const contentWidth = 480;
      doc.font("Times-Roman").fontSize(12);
      doc.text("SOLICITUD: ACTA DE ASAMBLEA", leftX, 170, { width: contentWidth });

      const comuneroY = 196;
      doc.text(`COMUNERO ( ${comuneroFlag ? "X" : " "} )`, 160, comuneroY, { width: 140, align: "center" });
      doc.text(`NO COMUNERO ( ${comuneroFlag ? " " : "X"} )`, 315, comuneroY, { width: 170, align: "center" });
      doc.moveDown(0.95);

      const buyerName = toUpperDisplay(request.buyerFullName || client.fullName);
      const sellerName = toUpperDisplay(request.sellerFullName || "");
      const sectorLocation = toUpperDisplay(request.sectorLocation || certificate.sector?.name || "");
      const terrainType = toUpperDisplay(request.terrainType || certificate.terrainType?.name || "");
      const email = toUpperDisplay(request.email || "");
      const phone = toUpperDisplay(request.phone || "");
      const possessionTime = toUpperDisplay(request.possessionTime || "");
      const widthText = toDecimalText(widthValue) ? `${toDecimalText(widthValue)} m.` : "";
      const lengthText = toDecimalText(lengthValue) ? `${toDecimalText(lengthValue)} m.` : "";
      const totalAreaText = toDecimalText(totalAreaValue) ? `${toDecimalText(totalAreaValue)} m2.` : "";

      drawLineText(doc, "NOMBRE Y APELLIDO DEL COMPRADOR", buyerName, leftX, contentWidth);
      drawLineText(doc, "NOMBRE Y APELLIDO DEL VENDEDOR", sellerName, leftX, contentWidth);
      drawLineText(doc, "UBICACION", sectorLocation, leftX, contentWidth);
      drawLineText(doc, "TIPO DE TERRENO", terrainType, leftX, contentWidth);
      drawLineText(doc, "ANCHO", widthText, leftX, contentWidth);
      drawLineText(doc, "LARGO", lengthText, leftX, contentWidth);
      drawLineText(doc, "AREA TOTAL", totalAreaText, leftX, contentWidth);
      drawLineText(doc, "FECHA DE ADJUDICACION (FECHA DE CONTRATO COMPRA Y VENTA)", awardDateValue, leftX, contentWidth);
      drawLineText(doc, "TIEMPO DE POSESION DEL TERRENO", possessionTime ? `${possessionTime}` : "", leftX, contentWidth);
      drawLineText(doc, "CORREO ELECTRONICO", email, leftX, contentWidth);
      drawLineText(doc, "TELEFONO", phone, leftX, contentWidth);
      drawLineText(doc, "CODIGO DEL CERTIFICADO", toUpperDisplay(certificate.certificateNumber), leftX, contentWidth);

      doc.moveDown(0.95);
      doc.font("Times-Roman").fontSize(12).text("ADJUNTAR:", leftX, doc.y, { width: contentWidth });
      doc.moveDown(0.65);

      const attachmentRows = [
        ["CertPosesion", "Certificado de posesion"],
        ["PlanoMemoria", "Plano y memoria"],
        ["DniCompradores", "DNI de los adjudicadores o compradores"],
        ["DniVendedor", "DNI del vendedor"],
        ["ContratoCV", "Contrato de compra venta notariado"],
        ["Testimonio", "Testimonio de adjudicacion"],
        ["ObservacionRegistros", "Observacion de Registros (Esquela de observacion)"],
      ];

      attachmentRows.forEach(([token, label]) => {
        drawAttachmentLine(doc, attachmentTypes.has(token), label, leftX + 6, contentWidth);
      });

      doc.moveDown(0.75);

      const qrSize = 80;
      const qrX = 462;
      const qrY = 620;
      const trackingUrl = buildTrackingUrl(certificate.certificateNumber);
      const qrBuffer = await toQrBuffer(trackingUrl);
      doc.image(qrBuffer, qrX, qrY, { fit: [qrSize, qrSize] });

      const customerCareY = qrY + qrSize + 8;
      doc.font("Times-Bold").fontSize(12).text("Número de atención al cliente 01 641 3577", leftX, customerCareY, {
        width: 492,
        align: "right",
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  buildAssemblyRecordRequestTemplatePdf,
};
