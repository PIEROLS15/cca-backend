const asyncHandler = require("../../../utils/async-handler");
const HttpError = require("../../../utils/http-error");
const { sendSuccess } = require("../../../utils/api-response");
const commonerLicensesService = require("../services/commoner-licenses.service");
const path = require("path");
const { buildCommonerLicensePdf } = require("../utils/commoner-licenses-pdf.utils");
const { resolveUploadDir } = require("../../../utils/file-storage");

const listCommonerLicenses = asyncHandler(async (req, res) => {
  const data = await commonerLicensesService.listCommonerLicenses({
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search,
    rangeField: req.query.rangeField,
    rangeFrom: req.query.rangeFrom,
    rangeTo: req.query.rangeTo,
  });

  return sendSuccess(res, {
    message: "Carnets de comunero encontrados correctamente",
    data,
  });
});

const searchCommonerLicenses = asyncHandler(async (req, res) => {
  const term = req.params.term || req.query.search;

  if (!term || String(term).trim().length < 3) {
    throw new HttpError(400, "Ingrese al menos 3 caracteres para buscar");
  }

  const data = await commonerLicensesService.searchCommonerLicenses({
    term,
    page: req.query.page,
    limit: req.query.limit,
  });

  return sendSuccess(res, {
    message: "Carnets de comunero encontrados correctamente",
    data,
  });
});

const getCommonerLicenseById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    throw new HttpError(400, "ID invalido");
  }

  const license = await commonerLicensesService.getCommonerLicenseById(id);
  res.json(license);
});

const createCommonerLicense = asyncHandler(async (req, res) => {
  const { dni, numeroComunero } = req.body;

  if (!dni || !numeroComunero) {
    throw new HttpError(400, "Debes enviar dni y numero de comunero");
  }

  const created = await commonerLicensesService.createCommonerLicense({ dni, numeroComunero });
  res.status(201).json(created);
});

const deleteCommonerLicense = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    throw new HttpError(400, "ID invalido");
  }

  await commonerLicensesService.deleteCommonerLicense(id);
  res.status(204).send();
});

const updateCommonerLicenseStatus = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    throw new HttpError(400, "ID invalido");
  }

  const { status } = req.body;
  if (!status) {
    throw new HttpError(400, "Debes enviar el campo status");
  }

  const updated = await commonerLicensesService.updateCommonerLicenseStatus(id, status);
  return sendSuccess(res, {
    message: `Estado cambiado a "${status}"`,
    data: updated,
  });
});

const toPositiveInteger = (value) => {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const buildPdfReadyLicense = (license) => ({
  ...license,
  firstNames: String(license.firstNames || "").trim() || String(license.fullName || "").trim(),
  lastNames: String(license.lastNames || "").trim(),
  photoFilePath: license.photoPath || license.photoUrl
    ? path.join(resolveUploadDir(), path.basename(license.photoPath || license.photoUrl))
    : null,
});

const sortLicensesByNumber = (items = []) => [...items].sort((a, b) => {
  const aNumber = Number(String(a.licenseNumber || "").trim());
  const bNumber = Number(String(b.licenseNumber || "").trim());

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber) && aNumber !== bNumber) {
    return aNumber - bNumber;
  }

  return Number(a.id || 0) - Number(b.id || 0);
});

const getRangeField = (value) => {
  const normalized = String(value || "licenseNumber").trim();

  if (normalized === "dni") {
    return "dni";
  }

  return "licenseNumber";
};

const normalizeRangeText = (value) => String(value || "").trim();

const compareRangeValue = (license, field) => normalizeRangeText(license[field]);

const normalizeListValues = (value) => String(value || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const findByListValue = (records = [], value) => {
  const normalized = normalizeRangeText(value);
  return records.find((record) => normalizeRangeText(record.dni) === normalized || normalizeRangeText(record.licenseNumber) === normalized);
};

const downloadCommonerLicensePdf = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    throw new HttpError(400, "ID invalido");
  }

  const license = await commonerLicensesService.getCommonerLicenseById(id);
  const photoFilePath = license.photoPath || license.photoUrl
    ? path.join(resolveUploadDir(), path.basename(license.photoPath || license.photoUrl))
    : null;

  const pdfBuffer = await buildCommonerLicensePdf({
    ...license,
    firstNames: String(license.firstNames || "").trim() || String(license.fullName || "").trim(),
    lastNames: String(license.lastNames || "").trim(),
    photoFilePath,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="carnet-comunero-${license.licenseNumber}.pdf"`);
  res.send(pdfBuffer);
});

const downloadCommonerLicensesPdf = asyncHandler(async (req, res) => {
  const mode = String(req.query.mode || "").trim().toLowerCase();
  const field = getRangeField(req.query.field);
  const search = String(req.query.search || "").trim();
  const values = normalizeListValues(req.query.values);
  const id = toPositiveInteger(req.query.id);
  const from = toPositiveInteger(req.query.from);
  const to = toPositiveInteger(req.query.to);
  const allRequested = ["1", "true", "yes"].includes(String(req.query.all || "").trim().toLowerCase());

  let licenses = [];
  let filename = "carnets-comuneros.pdf";

  if (mode === "single" || (!mode && id)) {
    if (!id) {
      throw new HttpError(400, "Debe enviar un id valido");
    }

    const license = await commonerLicensesService.getCommonerLicenseById(id);
    licenses = [buildPdfReadyLicense(license)];
    filename = `carnet-comunero-${license.licenseNumber}.pdf`;
  } else if (mode === "range" || (!mode && (from || to))) {
    if (!from || !to) {
      throw new HttpError(400, "Debe enviar from y to validos");
    }

    const [min, max] = from <= to ? [from, to] : [to, from];
    const records = await commonerLicensesService.listAllCommonerLicenses({ search: search || undefined });
    licenses = sortLicensesByNumber(records)
      .filter((record) => {
        const numeric = Number(compareRangeValue(record, field));
        return Number.isFinite(numeric) && numeric >= min && numeric <= max;
      })
      .map(buildPdfReadyLicense);
    filename = `carnets-comuneros-${field}-${min}-${max}.pdf`;
  } else if (mode === "all" || allRequested || (!mode && !id && !from && !to)) {
    const records = await commonerLicensesService.listAllCommonerLicenses({ search: search || undefined });
    licenses = sortLicensesByNumber(records).map(buildPdfReadyLicense);
    filename = search ? `carnets-comuneros-${search}.pdf` : filename;
  } else if (mode === "list") {
    if (!values.length) {
      throw new HttpError(400, "Debe enviar values validos");
    }

    const records = await commonerLicensesService.listAllCommonerLicenses({ search: search || undefined });
    const found = [];
    const missing = [];
    const seenIds = new Set();

    for (const value of values) {
      const match = findByListValue(records, value);

      if (!match) {
        missing.push(value);
        continue;
      }

      if (seenIds.has(match.id)) {
        continue;
      }

      seenIds.add(match.id);
      found.push(buildPdfReadyLicense(match));
    }

    if (!found.length) {
      throw new HttpError(404, `No se encontraron carnets para: ${missing.join(", ") || values.join(", ")}`);
    }

    if (missing.length) {
      throw new HttpError(404, `No se encontraron carnets para: ${missing.join(", ")}`);
    }

    licenses = found;
    filename = `carnets-comuneros-lista.pdf`;
  } else {
    throw new HttpError(400, "Modo de impresion invalido");
  }

  if (!licenses.length) {
    throw new HttpError(404, "No se encontraron carnets para imprimir");
  }

  const pdfBuffer = await buildCommonerLicensePdf(licenses);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.send(pdfBuffer);
});

module.exports = {
  listCommonerLicenses,
  searchCommonerLicenses,
  getCommonerLicenseById,
  createCommonerLicense,
  deleteCommonerLicense,
  updateCommonerLicenseStatus,
  downloadCommonerLicensePdf,
  downloadCommonerLicensesPdf,
};
