const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

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

const toUpperDisplay = (value) => String(value ?? "").toUpperCase();

const toDisplayDate = (value) => {
  const date = value ? new Date(value) : new Date();
  const monthNames = [
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SETIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
  ];

  return `ASIA, ${date.getDate()} DE ${monthNames[date.getMonth()]} DEL ${date.getFullYear()}`;
};

const buildAssemblyRecordRequestTemplatePdf = async (request) => {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks = [];

  const client = request.client || {};
  const certificate = request.certificate || {};

  return new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      const logoPath = resolveLogoPath();

      if (logoPath) {
        doc.image(logoPath, 42, 20, { fit: [158, 54] });
      }

      doc.font("Times-Roman").fontSize(14).text(
        '"Año de la recuperación y consolidación de la economía peruana"',
        270,
        26,
        { align: "center", width: 280 }
      );

      doc.font("Times-Bold").fontSize(16).text(
        `SOLICITUD DE ACTA DE ASAMBLEA`,
        50,
        92,
        { width: 492, align: "center", underline: true }
      );

      doc.font("Times-Roman").fontSize(11).text(
        `Código: ${request.code}`,
        50,
        120,
        { width: 492, align: "right" }
      );

      doc.font("Times-Roman").fontSize(12).text(
        toDisplayDate(request.createdAt),
        50,
        140,
        { width: 492, align: "right" }
      );

      doc.y = 168;
      doc.font("Times-Roman").fontSize(12).text(
        "SOLICITO, EXPEDICIÓN DE ACTA DE ASAMBLEA",
        52,
        doc.y,
        { lineGap: 0 }
      );
      doc.moveDown(1.2);

      doc.font("Times-Bold").fontSize(12).text(
        "SR. ALFREDO ENRIQUE GARCIA PENAS",
        52,
        doc.y,
        { width: 492, lineGap: 0, characterSpacing: 0.2 }
      );
      doc.font("Times-Roman").fontSize(12);
      doc.text(
        "PRESIDENTE DE LA COMUNIDAD CAMPESINA DE ASIA",
        52,
        doc.y,
        { width: 492, lineGap: 0 }
      );
      doc.moveDown(0.65);

      const intro = `Yo, ${toUpperDisplay(client.fullName)}, identificado con DNI N° ${toUpperDisplay(client.documentNumber)},`;
      doc.text(intro, 52, doc.y, { width: 470, align: "justify", lineGap: 0 });
      doc.moveDown(1.1);

      doc.text(
        "Ante usted me presento y expongo:",
        52,
        doc.y,
        { width: 492, lineGap: 0 }
      );
      doc.moveDown(0.2);

      doc.font("Times-Roman").text(
        toUpperDisplay(request.description || "Solicito se expida el acta de asamblea correspondiente."),
        52,
        doc.y,
        { width: 470, align: "left", lineGap: 0 }
      );
      doc.moveDown(0.8);

      doc.font("Times-Bold").fontSize(12).text(
        `Certificado asociado: ${toUpperDisplay(certificate.certificateNumber)}`,
        52,
        doc.y,
        { width: 492, lineGap: 0 }
      );
      doc.moveDown(1.2);

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
      doc.text(`DNI: ${toUpperDisplay(client.documentNumber)}`, 52, doc.y, {
        width: 492,
        align: "center",
        lineGap: 0,
      });
      doc.moveDown(1.2);

      if (request.user) {
        doc.fontSize(10).fillColor("#666666").text(
          `Registrado por: ${request.user.fullName}`,
          52,
          doc.y,
          { width: 492, align: "left", lineGap: 0 }
        );
        doc.fillColor("#000000");
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  buildAssemblyRecordRequestTemplatePdf,
};
