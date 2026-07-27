const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const bwipjs = require("bwip-js");

// ── HOJA A4 VERTICAL ──────────────────────────────────────────────────────
const PAGE_WIDTH = 595.28; // 210mm
const PAGE_HEIGHT = 841.89; // 297mm

// ── TARJETA CR80 REAL: 85.6 x 53.98 mm ───────────────────────────────────
const CARD_WIDTH = (85.6 * 72) / 25.4;
const CARD_HEIGHT = (53.98 * 72) / 25.4;

// ── GRILLA DE IMPRESIÓN: 2 columnas x 5 filas = 10 carnets por hoja ─────
const MARGIN = (10 * 72) / 25.4; // 10mm de margen para guías de corte
const COLS = 2;
const ROWS = 5;
const PER_PAGE = COLS * ROWS;

const printableW = PAGE_WIDTH - MARGIN * 2;
const printableH = PAGE_HEIGHT - MARGIN * 2;
// El espacio sobrante (además del margen de 10mm) se reparte como
// separación entre tarjetas -> también sirve de guía de corte.
const GAP_X = COLS > 1 ? (printableW - COLS * CARD_WIDTH) / (COLS - 1) : 0;
const GAP_Y = ROWS > 1 ? (printableH - ROWS * CARD_HEIGHT) / (ROWS - 1) : 0;

// ── LIENZO DE DISEÑO (dimensiones nativas de la plantilla PNG) ──────────
const TEMPLATE_WIDTH = 1158;
const TEMPLATE_HEIGHT = 726;

const PHOTO_FRAME = { x: 861, y: 200, w: 260, h: 325, r: 14 };
const QR_BOX = { x: 590, y: 245, size: 180 }; // QR reducido y movido a la izquierda

// Posiciones de los valores. Ya NO se fuerza un alineado común entre
// nombre / DNI / N° de carnet: cada uno tiene su propia posición fija,
// más grande, y se dibuja de forma independiente.
const NAME_POS = { x: 550, y: 542, size: 34 };
// y=619 y y=682 alinean el TOPE de estos valores con el tope de las
// etiquetas "DNI:" y "N°:" ya impresas en la plantilla (verificado
// píxel a píxel).
const DNI_VALUE_POS = { x: 898, y: 619, size: 28 };
const LICENSE_VALUE_POS = { x: 945, y: 682, size: 36 };

const TEMPLATE_CANDIDATE_PATHS = [
  path.resolve(__dirname, "..", "..", "assets", "commoner-license-template.png"),
  path.resolve(__dirname, "..", "..", "assets", "plantilla_carnet_comunero_blanco.png"),
  path.resolve(process.cwd(), "src", "assets", "commoner-license-template.png"),
  path.resolve(process.cwd(), "src", "assets", "plantilla_carnet_comunero_blanco.png"),
  path.resolve(process.cwd(), "assets", "commoner-license-template.png"),
  path.resolve(process.cwd(), "assets", "plantilla_carnet_comunero_blanco.png"),
];

const resolveTemplatePath = () => TEMPLATE_CANDIDATE_PATHS.find((candidate) => fs.existsSync(candidate));

const resolvePhotoSource = (license) => license.photoUrl || license.photoPath || license.photoFilePath || null;

const loadPhotoBuffer = async (license) => {
  const source = resolvePhotoSource(license);
  if (!source) return null;
  if (Buffer.isBuffer(source)) return source;

  const text = String(source).trim();
  if (!text) return null;

  if (text.startsWith("data:")) {
    const base64 = text.split(",")[1] || "";
    return Buffer.from(base64, "base64");
  }

  if (/^https?:\/\//i.test(text)) {
    const response = await fetch(text);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }

  if (fs.existsSync(text)) return fs.readFileSync(text);

  if (text.startsWith("/")) {
    const localPath = path.resolve(process.cwd(), `.${text}`);
    if (fs.existsSync(localPath)) return fs.readFileSync(localPath);
  }

  return null;
};

const toQrBuffer = (value) =>
  new Promise((resolve, reject) => {
    bwipjs.toBuffer({ bcid: "qrcode", text: String(value), scale: 6 }, (error, png) =>
      error ? reject(error) : resolve(png),
    );
  });

const toUpperDisplay = (value) => String(value ?? "").toUpperCase();

const buildCommonerLicenseVerificationUrl = (licenseNumber) => {
  const baseUrl = String(process.env.API_BASE_URL || "http://localhost:9001").replace(/\/$/, "");
  return `${baseUrl}/api/public/commoner-licenses/${encodeURIComponent(licenseNumber)}`;
};

const normalizeLicensesInput = (licenseOrLicenses) => {
  if (Array.isArray(licenseOrLicenses)) return licenseOrLicenses.filter(Boolean);
  return licenseOrLicenses ? [licenseOrLicenses] : [];
};

// Posición (x,y) de la esquina superior izquierda de la tarjeta N dentro
// de la hoja, según la grilla 2x5.
const slotPosition = (indexInPage) => {
  const row = Math.floor(indexInPage / COLS);
  const col = indexInPage % COLS;
  const x = MARGIN + col * (CARD_WIDTH + GAP_X);
  const y = MARGIN + row * (CARD_HEIGHT + GAP_Y);
  return { x, y };
};

// Marcas de corte (pequeñas L en cada esquina) para CADA slot de la
// grilla, esté o no ocupado — así, aunque imprimas un solo carnet, la
// hoja completa queda lista como guía para cortar cuando llenes el resto.
const drawCropMarks = (doc, x, y) => {
  const len = 8;
  doc.save();
  doc.lineWidth(0.5).strokeColor("#aaaaaa");
  const corners = [
    [x, y, 1, 1],
    [x + CARD_WIDTH, y, -1, 1],
    [x, y + CARD_HEIGHT, 1, -1],
    [x + CARD_WIDTH, y + CARD_HEIGHT, -1, -1],
  ];
  corners.forEach(([cx, cy, dx, dy]) => {
    doc.moveTo(cx, cy).lineTo(cx + len * dx, cy).stroke();
    doc.moveTo(cx, cy).lineTo(cx, cy + len * dy).stroke();
  });
  doc.restore();
};

const drawCard = async (doc, license, x, y) => {
  doc.save();
  doc.translate(x, y);

  // Encaja el lienzo de diseño (1158x726) dentro de la tarjeta física
  // (85.6x53.98mm). Los ratios son casi idénticos (1.595 vs 1.585), así
  // que el letterbox resultante es de menos de 1pt — imperceptible.
  const scale = Math.min(CARD_WIDTH / TEMPLATE_WIDTH, CARD_HEIGHT / TEMPLATE_HEIGHT);
  const contentW = TEMPLATE_WIDTH * scale;
  const contentH = TEMPLATE_HEIGHT * scale;
  doc.translate((CARD_WIDTH - contentW) / 2, (CARD_HEIGHT - contentH) / 2);
  doc.scale(scale);

  const templatePath = resolveTemplatePath();
  if (templatePath) {
    doc.image(templatePath, 0, 0, { width: TEMPLATE_WIDTH, height: TEMPLATE_HEIGHT });
  } else {
    doc.rect(0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT).fill("#ffffff");
  }

  const qrUrl = buildCommonerLicenseVerificationUrl(license.licenseNumber || license.dni || license.id);
  const qrBuffer = await toQrBuffer(qrUrl);
  doc.image(qrBuffer, QR_BOX.x, QR_BOX.y, { fit: [QR_BOX.size, QR_BOX.size] });

  // La foto se dibuja un poco más chica que el recuadro (10px de margen
  // interno en el sistema de coordenadas de la plantilla) para que el
  // contorno YA IMPRESO en la plantilla quede visible alrededor, en vez
  // de que la foto lo tape por completo.
  const PHOTO_INSET = 10;
  const photoX = PHOTO_FRAME.x + PHOTO_INSET;
  const photoY = PHOTO_FRAME.y + PHOTO_INSET;
  const photoW = PHOTO_FRAME.w - PHOTO_INSET * 2;
  const photoH = PHOTO_FRAME.h - PHOTO_INSET * 2;

  doc.save();
  doc.roundedRect(photoX, photoY, photoW, photoH, Math.max(PHOTO_FRAME.r - PHOTO_INSET, 4)).clip();
  doc.rect(photoX, photoY, photoW, photoH).fill("#ffffff");

  const photoBuffer = await loadPhotoBuffer(license);
  if (photoBuffer) {
    doc.image(photoBuffer, photoX, photoY, {
      cover: [photoW, photoH],
      align: "center",
      valign: "center",
    });
  } else {
    doc
      .font("Helvetica")
      .fontSize(16)
      .fillColor("#202020")
      .text("FOTO", photoX, photoY + photoH / 2 - 8, {
        width: photoW,
        align: "center",
      });
  }
  doc.restore();
  // Ya NO se dibuja un stroke extra aquí: la plantilla ya trae impreso el
  // contorno del recuadro de foto. Ese stroke duplicado era el "contorno
  // negro extra" que se veía sobre la foto.

  // Nombre, DNI y N° de carnet: cada uno con su propia posición y tamaño,
  // sin forzar que compartan un mismo borde de alineación.
  doc
    .font("Helvetica")
    .fontSize(NAME_POS.size)
    .fillColor("#27704b")
    .text(`${toUpperDisplay(license.firstNames)} `, NAME_POS.x, NAME_POS.y, { continued: true, lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(NAME_POS.size).fillColor("#1f5837").text(toUpperDisplay(license.lastNames), { lineBreak: false });

  doc
    .font("Helvetica-Bold")
    .fontSize(DNI_VALUE_POS.size)
    .fillColor("#1f5837")
    .text(toUpperDisplay(license.dni), DNI_VALUE_POS.x, DNI_VALUE_POS.y);

  doc
    .font("Helvetica-Bold")
    .fontSize(LICENSE_VALUE_POS.size)
    .fillColor("#1f5837")
    .text(toUpperDisplay(license.licenseNumber), LICENSE_VALUE_POS.x, LICENSE_VALUE_POS.y);

  doc.restore();
};

/**
 * Genera un PDF en hoja A4 vertical con una grilla de 2x5 carnets (10 por
 * hoja). Si se pasa un solo carnet (o un array de 1), se renderiza igual
 * dentro de la grilla — ocupando el primer slot — y el resto de la hoja
 * queda con las guías de corte listas para completarse después.
 */
const buildCommonerLicensePdf = async (licenseOrLicenses) => {
  const licenses = normalizeLicensesInput(licenseOrLicenses);
  if (licenses.length === 0) {
    throw new Error("No hay carnets para imprimir");
  }

  const doc = new PDFDocument({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0 });
  const chunks = [];

  return new Promise(async (resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      const totalPages = Math.ceil(licenses.length / PER_PAGE);

      for (let page = 0; page < totalPages; page += 1) {
        if (page > 0) {
          doc.addPage({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0 });
        }

        for (let slot = 0; slot < PER_PAGE; slot += 1) {
          const globalIndex = page * PER_PAGE + slot;
          const { x, y } = slotPosition(slot);

          drawCropMarks(doc, x, y);

          if (globalIndex < licenses.length) {
            // eslint-disable-next-line no-await-in-loop
            await drawCard(doc, licenses[globalIndex], x, y);
          }
        }
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  buildCommonerLicensePdf,
};