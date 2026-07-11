const PDFDocument = require("pdfkit");
const bwipjs = require("bwip-js");
const { buildCertificateVerificationUrl } = require("../../api/certificates/utils/certificate-verification.utils");

const WIDTH = 595.28;
const HEIGHT = 841.89;

const toUpperDisplay = (value) => String(value ?? "").toUpperCase();

const monthNames = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SETIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

const toDisplayDate = (value) => {
  const date = value ? new Date(value) : new Date();
  return `${date.getDate()} DE ${monthNames[date.getMonth()]} DEL ${date.getFullYear()}`;
};

const toQrBuffer = (value) =>
  new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      { bcid: "qrcode", text: String(value), scale: 6 },
      (error, png) => (error ? reject(error) : resolve(png))
    );
  });

const hasValue = (value) => value !== null && value !== undefined && value !== "";

const formatTwoDecimals = (value) => (hasValue(value) ? Number(value).toFixed(2) : "");

const buildPossessionSegments = (certificate) => {
  const terrain = certificate.terrain || {};
  const terrainTypeName = toUpperDisplay(terrain.terrainType?.name || "");
  const measurementMode = terrain.measurementModeUsed || "RECTANGULAR_AUTO";

  const width = formatTwoDecimals(terrain.width);
  const length = formatTwoDecimals(terrain.length);
  const totalArea = formatTwoDecimals(terrain.totalArea);
  const area = formatTwoDecimals(terrain.area);
  const perimeter = formatTwoDecimals(terrain.perimeter);
  const additionalWidth = formatTwoDecimals(terrain.additionalWidth);
  const additionalLength = formatTwoDecimals(terrain.additionalLength);
  const hasAdditionalMeasure = Boolean(additionalWidth && additionalLength);
  const segments = [];

  segments.push({ text: "ES POSESIONARIO DE UN TERRENO DE ", bold: false });
  if (terrainTypeName) segments.push({ text: terrainTypeName, bold: true });

  if (measurementMode === "AREA_PERIMETER") {
    if (perimeter) {
      segments.push({ text: " DE PERÍMETRO ", bold: false });
      segments.push({ text: `${perimeter} ML`, bold: true });
    }
    if (area) {
      segments.push({ text: " Y ÁREA ", bold: false });
      segments.push({ text: `${area} M²`, bold: true });
    }
    if (hasAdditionalMeasure) {
      segments.push({ text: ". MÁS UNA MEDIDA ADICIONAL DE ", bold: false });
      segments.push({ text: `${additionalWidth} X ${additionalLength} METROS`, bold: true });
    }
    segments.push({ text: ".", bold: false });
    return segments;
  }

  if (measurementMode === "MANUAL_TOTAL_AREA") {
    if (totalArea) {
      segments.push({ text: " DE ÁREA TOTAL ", bold: false });
      segments.push({ text: `${totalArea} M²`, bold: true });
    }
    if (hasAdditionalMeasure) {
      segments.push({ text: ". MÁS UNA MEDIDA ADICIONAL DE ", bold: false });
      segments.push({ text: `${additionalWidth} X ${additionalLength} METROS`, bold: true });
    }
    segments.push({ text: ".", bold: false });
    return segments;
  }

  if (width && length) {
    segments.push({ text: " DE ", bold: false });
    segments.push({ text: `${width} X ${length} METROS`, bold: true });
  }
  if (hasAdditionalMeasure) {
    segments.push({ text: ", MÁS UNA MEDIDA ADICIONAL DE ", bold: false });
    segments.push({ text: `${additionalWidth} X ${additionalLength} METROS`, bold: true });
    if (totalArea) {
      segments.push({ text: ".", bold: false });
      segments.push({ text: " DE UN ÁREA TOTAL DE ", bold: false });
      segments.push({ text: `${totalArea} M²`, bold: true });
      segments.push({ text: ".", bold: false });
      return segments;
    }

    segments.push({ text: ".", bold: false });
    return segments;
  }
  if (totalArea) {
    segments.push({ text: ". DE UN ÁREA TOTAL DE ", bold: false });
    segments.push({ text: `${totalArea} M²`, bold: true });
  }

  segments.push({ text: ".", bold: false });

  return segments;
};

const renderTextSegments = (doc, segments, x, y, options = {}) => {
  segments.forEach((segment, index) => {
    const textOptions = {
      ...options,
      continued: index < segments.length - 1,
    };

    if (index === 0) {
      doc.font(segment.bold ? "Times-Bold" : "Times-Roman").text(segment.text, x, y, textOptions);
      return;
    }

    doc.font(segment.bold ? "Times-Bold" : "Times-Roman").text(segment.text, textOptions);
  });
};

const drawCodeGrid = (doc, code, startY) => {
  const fontSize = 15;
  const baseX = 50;
  const indentX = 58;
  const stepX = 100;
  const stepY = 18;
  const cols = 4;

  doc.font("Times-Roman").fontSize(fontSize).fillColor("#b7c8ef");

  const drawGroup = (groupStartY) => {
    for (let row = 0; row < 3; row++) {
      const rowX = (row % 2 === 0) ? baseX : indentX;
      for (let col = 0; col < cols; col++) {
        doc.text(code, rowX + col * stepX, groupStartY + row * stepY, {
          width: 110,
          align: "left",
          lineBreak: false,
        });
      }
    }
  };

  drawGroup(startY);
  drawGroup(startY + 3 * stepY + 18);

  doc.fillColor("#000000");
};

const buildCertificatePdf = async (certificate) => {
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const chunks = [];

  return new Promise(async (resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      const owners = certificate.owners || [];
      const ownerNames = owners.map((o) => toUpperDisplay(o.fullName)).join(" Y ");
      const ownerDocs = owners.map((o) => toUpperDisplay(o.documentNumber)).join(" Y ");
      const dateStr = toDisplayDate(certificate.createdAt);
      const code = certificate.certificateNumber || "";
      const qrValue = buildCertificateVerificationUrl(certificate.verificationToken || certificate.certificateNumber || code);
      const bodyWidth = 495;
      const leftMargin = 50;

      doc.rect(0, 0, WIDTH, HEIGHT).fill("#ffffff");
      doc.fillColor("#000000");

      doc.font("Times-Bold").fontSize(20);
      doc.text("CERTIFICADO DE POSESIÓN", 0, 168, { align: "center", width: WIDTH });

      doc.save();
      doc.lineWidth(3).moveTo(leftMargin, 196).lineTo(545, 196).stroke("#2e7d32");
      doc.restore();

      doc.font("Times-Roman").fontSize(12);
      doc.text(
        "LOS QUE SE SUSCRIBEN MIEMBROS DE LA JUNTA DIRECTIVA DE LA COMUNIDAD CAMPESINA DE ASIA.",
        leftMargin, 210, { width: bodyWidth }
      );
      doc.text("CERTIFICA QUE EL COMUNERO O SEÑOR:", leftMargin, doc.y + 14, { width: bodyWidth });

      doc.font("Times-Bold").fontSize(12).text(ownerNames || "", leftMargin, doc.y + 14, {
        width: bodyWidth,
      });

      doc.font("Times-Roman").fontSize(12);
      doc.text("IDENTIFICADO CON DNI / CÓDIGO N° ", leftMargin, doc.y + 10, { continued: true });
      doc.font("Times-Bold").text(ownerDocs || "");

      const green2Y = doc.y + 20;
      doc.save();
      doc.lineWidth(3).moveTo(leftMargin, green2Y).lineTo(545, green2Y).stroke("#2e7d32");
      doc.restore();

      let curY = green2Y + 20;
      const possessionSegments = buildPossessionSegments(certificate);

      doc.font("Times-Roman").fontSize(12);
      renderTextSegments(doc, possessionSegments, leftMargin, curY, { width: bodyWidth, lineGap: 0 });

      curY = doc.y + 8;
      doc.font("Times-Roman").fontSize(12);
      doc.text("UBICADO EN EL SECTOR DE: ", leftMargin, curY, { continued: true });
      doc.font("Times-Bold").text(toUpperDisplay(certificate.location?.sectors?.name));

      curY = doc.y + 8;
      doc.font("Times-Roman").text("MZ: ", leftMargin, curY, { continued: true });
      doc.font("Times-Bold").text(toUpperDisplay(certificate.location?.mz));
      doc.font("Times-Roman").text("LOTE: ", 240, curY, { continued: true });
      doc.font("Times-Bold").text(toUpperDisplay(certificate.location?.lot));

      curY = doc.y + 10;
      doc.font("Times-Roman").fontSize(12);
      doc.text(
        "DISTRITO DE ASIA, PROVINCIA DE CAÑETE Y DEPARTAMENTO DE LIMA.",
        leftMargin, curY, { width: bodyWidth }
      );

      curY = doc.y + 12;
      doc.font("Times-Roman").text(
        "DATOS ADICIONALES UBICACIÓN CON LAS SIGUIENTES COLINDANCIAS:",
        leftMargin, curY, { width: bodyWidth }
      );

      const borders = [
        { label: "POR EL NORTE", value: certificate.borders?.north },
        { label: "POR EL SUR", value: certificate.borders?.south },
        { label: "POR EL ESTE", value: certificate.borders?.east },
        { label: "POR EL OESTE", value: certificate.borders?.west },
      ];
      const borderLabelX = leftMargin;
      const borderLabelWidth = 96;
      const borderColonX = borderLabelX + borderLabelWidth + 2;
      const borderValueX = borderColonX + 10;
      let borderY = doc.y + 4;
      borders.forEach((b) => {
        doc.font("Times-Roman").text(b.label, borderLabelX, borderY, { width: borderLabelWidth });
        doc.font("Times-Roman").text(":", borderColonX, borderY);
        doc.font("Times-Bold").text(toUpperDisplay(b.value), borderValueX, borderY, {
          width: bodyWidth - (borderValueX - leftMargin),
        });
        borderY = doc.y + 1;
      });

      const notesValue = toUpperDisplay(certificate.additionalNotes).trim();
      let footerStartY = borderY + 10;
      const qrX = 462;
      const qrSize = 80;
      const textWidthSinQR = qrX - leftMargin - 10;
      const footerText = "SE EXPIDE EL PRESENTE CERTIFICADO DE POSESIÓN A SOLICITUD DEL INTERESADO Y PARA LOS FINES QUE CONSIDERE CONVENIENTE.";

      if (notesValue) {
        doc.font("Times-Roman").fontSize(12).text("NOTAS ADICIONALES:", leftMargin, footerStartY, { width: bodyWidth });
        const notesTextY = doc.y + 3;
        const notesHeight = doc.heightOfString(notesValue, { width: bodyWidth, align: "justify" });
        doc.font("Times-Roman").fontSize(12).text(notesValue, leftMargin, notesTextY, { width: bodyWidth, align: "justify" });
        footerStartY = notesTextY + notesHeight + 8;
      }

      const seExpideY = footerStartY + 4;
      const seExpideHeight = doc.heightOfString(footerText, { width: textWidthSinQR, align: "justify" });
      const fechaPreview = dateStr;
      const fechaHeight = doc.heightOfString(fechaPreview, { width: textWidthSinQR, align: "right" });
      const footerBottomY = Math.max(seExpideY + seExpideHeight, seExpideY + qrSize, seExpideY + seExpideHeight + 10 + fechaHeight);
      const gridBaseY = notesValue ? 570 : 625;
      const gridStartY = notesValue ? Math.max(gridBaseY, footerBottomY + 6) : gridBaseY;

      drawCodeGrid(doc, code, gridStartY);

      doc.font("Times-Roman").fontSize(12);
      doc.text(
        footerText,
        leftMargin, seExpideY, { width: textWidthSinQR, align: "justify" }
      );

      const fechaY = doc.y + 10;
      doc.font("Times-Roman").fontSize(12).fillColor("#000000");
      doc.text(dateStr, leftMargin, fechaY, { width: textWidthSinQR, align: "right" });

      const qrBuffer = await toQrBuffer(qrValue);
      doc.image(qrBuffer, qrX, seExpideY, { fit: [qrSize, qrSize] });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { buildCertificatePdf };
