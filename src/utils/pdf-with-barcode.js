const PDFDocument = require("pdfkit");
const bwipjs = require("bwip-js");

const toBarcodeBuffer = (value) =>
  new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: "code128",
        text: String(value),
        scale: 3,
        height: 12,
        includetext: true,
        textxalign: "center",
      },
      (error, png) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(png);
      }
    );
  });

const toDisplayValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value);
};

const createPdfWithBarcode = async ({ title, subtitle, fields, barcodeValue, footer }) => {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks = [];

  return new Promise(async (resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      doc.fontSize(18).text(title, { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor("#555555").text(subtitle || "", { align: "center" });
      doc.fillColor("#000000");
      doc.moveDown(1.2);

      fields.forEach((field) => {
        doc.fontSize(11).font("Helvetica-Bold").text(`${field.label}: `, { continued: true });
        doc.font("Helvetica").text(toDisplayValue(field.value));
        doc.moveDown(0.3);
      });

      doc.moveDown(1.2);
      const barcodeBuffer = await toBarcodeBuffer(barcodeValue);
      doc.image(barcodeBuffer, doc.x, doc.y, { fit: [500, 90], align: "center" });
      doc.moveDown(5);

      doc.fontSize(10).fillColor("#666666").text(`Codigo: ${barcodeValue}`, { align: "center" });
      if (footer) {
        doc.moveDown(0.6);
        doc.text(footer, { align: "center" });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  createPdfWithBarcode,
};
