const PDFDocument = require("pdfkit");
const bwipjs = require("bwip-js");

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

const drawCodeGrid = (doc, code) => {
  const fontSize = 15;
  const baseX = 50;
  const indentX = 58;
  const stepX = 100;
  const stepY = 18;
  const cols = 4;

  doc.fontSize(fontSize).fillColor("#b7c8ef");

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

  drawGroup(625);
  drawGroup(625 + 3 * stepY + 18);

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
      const w = certificate.terrain?.width;
      const l = certificate.terrain?.length;
      const a = certificate.terrain?.totalArea;
      const medidas = w != null && l != null
        ? `${Number(w).toFixed(2)}  X  ${Number(l).toFixed(2)} METROS`
        : "";
      const area = a != null ? `${Number(a).toFixed(2)}` : "";
      const dateStr = toDisplayDate(certificate.createdAt);
      const code = certificate.certificateNumber || "";
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
      doc.text("IDENTIFICADO CON DNI N° ", leftMargin, doc.y + 10, { continued: true });
      doc.font("Times-Bold").text(ownerDocs || "");

      const green2Y = doc.y + 20;
      doc.save();
      doc.lineWidth(3).moveTo(leftMargin, green2Y).lineTo(545, green2Y).stroke("#2e7d32");
      doc.restore();

      let curY = green2Y + 20;
      const posLine1 = "ES POSESIONARIO DE UN TERRENO DE ";
      const posLine2 = "VIVIENDA";
      const posLine3 = " DE ";
      const posLine4 = medidas || "";
      const posLine5 = ". DE UN ÁREA TOTAL DE ";
      const posLine6 = area ? `${area} M` : "";

      doc.font("Times-Roman").fontSize(12);
      doc.text(posLine1, leftMargin, curY, { continued: true, width: bodyWidth });
      doc.font("Times-Bold").text(posLine2, { continued: true, width: bodyWidth });
      doc.font("Times-Roman").text(posLine3, { continued: true, width: bodyWidth });
      if (posLine4) {
        doc.font("Times-Bold").text(posLine4, { continued: true, width: bodyWidth });
      }
      doc.font("Times-Roman").text(posLine5, { continued: true, width: bodyWidth });
      if (area) {
        doc.font("Times-Bold").text(posLine6, { continued: true, width: bodyWidth });
        const supX = doc.x;
        const supY = doc.y;
        doc.font("Times-Bold").fontSize(8).text("2", supX, supY - 3, { continued: true, width: bodyWidth });
        doc.font("Times-Bold").fontSize(12).text(".", { continued: false, width: bodyWidth });
      } else {
        doc.font("Times-Roman").text(".", { continued: false, width: bodyWidth });
      }

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
        { label: "POR EL SUR  ", value: certificate.borders?.south },
        { label: "POR EL ESTE ", value: certificate.borders?.east },
        { label: "POR EL OESTE", value: certificate.borders?.west },
      ];
      let borderY = doc.y + 4;
      borders.forEach((b) => {
        doc.font("Times-Roman").text(`${b.label}`, leftMargin, borderY, { continued: true });
        doc.font("Times-Roman").text(": ", { continued: true });
        doc.font("Times-Bold").text(toUpperDisplay(b.value));
        borderY = doc.y;
      });

      const qrX = 462;
      const qrSize = 80;

      const seExpideY = borderY + 14;
      const qrY = seExpideY;

      const textWidthSinQR = qrX - leftMargin - 10;
      doc.font("Times-Roman").fontSize(12);
      doc.text(
        "SE EXPIDE EL PRESENTE CERTIFICADO DE POSESIÓN A SOLICITUD DEL INTERESADO Y PARA LOS FINES QUE CONSIDERE CONVENIENTE.",
        leftMargin, seExpideY, { width: textWidthSinQR, align: "justify" }
      );

      const fechaY = doc.y + 10;
      doc.font("Times-Roman").fontSize(12).fillColor("#000000");
      doc.text(dateStr, leftMargin, fechaY, { width: textWidthSinQR, align: "right" });

      const qrBuffer = await toQrBuffer(code);
      doc.image(qrBuffer, qrX, qrY, { fit: [qrSize, qrSize] });

      drawCodeGrid(doc, code);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { buildCertificatePdf };
