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
// Nombre: ver NAME_RIGHT_EDGE más abajo (se alinea a la derecha, con
// tamaño automático).
const DNI_VALUE_POS = { x: 898 };
const LICENSE_VALUE_POS = { x: 945 };

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
  const raw = String(process.env.FRONTEND_URL || "http://localhost:9000").split(",")[0].trim();
  const frontendUrl = raw.replace(/\/$/, "");
  return `${frontendUrl}/comunero/${encodeURIComponent(licenseNumber)}`;
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
  // Nombre: alineado a la derecha (pegado al mismo borde que la foto),
  // más grande — igual que en la imagen de referencia. Si el nombre es
  // muy largo, se reduce el tamaño automáticamente para no invadir el QR.
  const NAME_RIGHT_EDGE = 1121;
  const NAME_MIN_X = 480;
  let nameFontSize = 38;
  const nombres = `${toUpperDisplay(license.firstNames)} `;
  const apellidos = toUpperDisplay(license.lastNames);
  let nameStartX;
  for (;;) {
    doc.font("Helvetica").fontSize(nameFontSize);
    const wNombres = doc.widthOfString(nombres);
    doc.font("Helvetica-Bold").fontSize(nameFontSize);
    const wApellidos = doc.widthOfString(apellidos);
    nameStartX = NAME_RIGHT_EDGE - (wNombres + wApellidos);
    if (nameStartX >= NAME_MIN_X || nameFontSize <= 16) break;
    nameFontSize -= 1;
  }
  doc.font("Helvetica").fontSize(nameFontSize).fillColor("#27704b").text(nombres, nameStartX, 542, { continued: true, lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(nameFontSize).fillColor("#1f5837").text(apellidos, { lineBreak: false });

  // Centrado vertical real contra las etiquetas impresas "DNI:" y "N°:":
  // doc.text(x, y) posiciona "y" como el TOPE del bloque de texto, no su
  // centro — por eso mientras más grande la letra, más se corría hacia
  // abajo respecto a la etiqueta (que es chica y fija). En vez de
  // adivinar un "y" por tamaño de fuente, centramos matemáticamente
  // usando el centro vertical medido de cada etiqueta en la plantilla y
  // un factor de corrección (k) calibrado para Helvetica-Bold.
  const VCENTER_K = 0.37;
  const DNI_LABEL_CENTER_Y = 632.5; // centro medido de "DNI:" en la plantilla
  const LICENSE_LABEL_CENTER_Y = 695.5; // centro medido de "N°:" en la plantilla
  const dniFontSize = 38;
  const licenseFontSize = 46;
  const dniY = DNI_LABEL_CENTER_Y - VCENTER_K * dniFontSize;
  const licenseY = LICENSE_LABEL_CENTER_Y - VCENTER_K * licenseFontSize;

  doc.font("Helvetica-Bold").fontSize(dniFontSize).fillColor("#1f5837").text(toUpperDisplay(license.dni), DNI_VALUE_POS.x, dniY);

  doc
    .font("Helvetica-Bold")
    .fontSize(licenseFontSize)
    .fillColor("#1f5837")
    .text(toUpperDisplay(license.licenseNumber), LICENSE_VALUE_POS.x, licenseY);

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