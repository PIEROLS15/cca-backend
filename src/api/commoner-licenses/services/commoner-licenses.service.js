const path = require("path");
const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const { saveDataUriFile, removeFileIfExists, resolveUploadDir } = require("../../../utils/file-storage");
const reniecService = require("./reniec.service");
const {
  normalizeSearchTerm,
  parseBirthDate,
  formatCommonerLicenseResponse,
  formatCommonerLicenseCollection,
} = require("../utils/commoner-licenses.utils");

const normalizeDocumentNumber = (value) => String(value || "").trim();
const normalizeLicenseNumber = (value) => String(value || "").trim();

const buildSearchWhere = (search) => {
  const term = normalizeSearchTerm(search);

  if (!term) {
    return {};
  }

  return {
    OR: [
      { dni: { contains: term, mode: "insensitive" } },
      { licenseNumber: { contains: term, mode: "insensitive" } },
      { fullName: { contains: term, mode: "insensitive" } },
      { firstNames: { contains: term, mode: "insensitive" } },
      { lastNames: { contains: term, mode: "insensitive" } },
    ],
  };
};

const buildRangeWhere = (rangeField, rangeFrom, rangeTo) => {
  const field = rangeField === "dni" ? "dni" : "licenseNumber";
  const from = String(rangeFrom || "").trim();
  const to = String(rangeTo || "").trim();

  if (!from && !to) return {};

  if (from && to) {
    const [min, max] = from <= to ? [from, to] : [to, from];
    return { [field]: { gte: min, lte: max } };
  }

  if (from) return { [field]: { gte: from } };
  return { [field]: { lte: to } };
};

const listCommonerLicenses = async ({ page, limit, search, rangeField, rangeFrom, rangeTo } = {}) => {
  const where = { ...buildSearchWhere(search), ...buildRangeWhere(rangeField, rangeFrom, rangeTo) };
  const hasRange = Boolean(rangeFrom || rangeTo);

  if (hasRange) {
    const docs = await prisma.commonerLicense.findMany({
      where,
      orderBy: [{ licenseNumber: "asc" }, { id: "asc" }],
    });

    const formatted = formatCommonerLicenseCollection(docs);
    return buildPaginationResult({
      docs: formatted,
      total: formatted.length,
      page: 1,
      limit: formatted.length,
    });
  }

  const pagination = getPaginationParams({ page, limit });

  const [docs, total] = await Promise.all([
    prisma.commonerLicense.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.commonerLicense.count({ where }),
  ]);

  return buildPaginationResult({
    docs: formatCommonerLicenseCollection(docs),
    total,
    page: pagination.page,
    limit: pagination.limit,
  });
};

const listAllCommonerLicenses = async ({ search } = {}) => {
  const where = buildSearchWhere(search);

  return formatCommonerLicenseCollection(await prisma.commonerLicense.findMany({
    where,
    orderBy: [{ licenseNumber: "asc" }, { id: "asc" }],
  }));
};

const getCommonerLicenseById = async (id) => {
  const license = await prisma.commonerLicense.findUnique({ where: { id } });

  if (!license) {
    throw new HttpError(404, "Carnet de comunero no encontrado");
  }

  return formatCommonerLicenseResponse(license);
};

const searchCommonerLicenses = async ({ term, page, limit } = {}) => {
  return listCommonerLicenses({ page, limit, search: term });
};

const createCommonerLicense = async ({ dni, numeroComunero }) => {
  const normalizedDni = normalizeDocumentNumber(dni);
  const normalizedLicenseNumber = normalizeLicenseNumber(numeroComunero);

  if (!/^\d{8}$/.test(normalizedDni)) {
    throw new HttpError(400, "El DNI debe tener 8 digitos");
  }

  if (!normalizedLicenseNumber) {
    throw new HttpError(400, "El numero de carnet es obligatorio");
  }

  const existing = await prisma.commonerLicense.findFirst({
    where: {
      OR: [
        { dni: normalizedDni },
        { licenseNumber: normalizedLicenseNumber },
      ],
    },
    select: { id: true },
  });

  if (existing) {
    throw new HttpError(409, "Ya existe un carnet registrado con ese DNI o numero de carnet");
  }

  const person = await reniecService.searchDetailedByDocument(normalizedDni, { withPhoto: true });

  if (!person.photoDataUri) {
    throw new HttpError(502, "La API no devolvio una foto valida");
  }

  if (!person.address) {
    throw new HttpError(502, "La API no devolvio la direccion del comunero");
  }

  const fileStem = `dni-${normalizedDni}-carnet-${normalizedLicenseNumber}`;
  const savedPhoto = await saveDataUriFile(person.photoDataUri, {
    fileStem,
    uploadDir: resolveUploadDir(),
  });

  try {
    const created = await prisma.commonerLicense.create({
      data: {
        dni: normalizedDni,
        licenseNumber: normalizedLicenseNumber,
        fullName: person.fullName || [person.firstNames, person.lastNames].filter(Boolean).join(" "),
        firstNames: person.firstNames || "",
        lastNames: person.lastNames || "",
        gender: person.gender || "",
        birthDate: parseBirthDate(person.birthDate),
        address: person.address,
        photoPath: savedPhoto.publicPath,
      },
    });

    return formatCommonerLicenseResponse(created);
  } catch (error) {
    await removeFileIfExists(savedPhoto.filePath);
    throw error;
  }
};

const deleteCommonerLicense = async (id) => {
  const current = await prisma.commonerLicense.findUnique({ where: { id } });

  if (!current) {
    throw new HttpError(404, "Carnet de comunero no encontrado");
  }

  const uploadDir = resolveUploadDir();
  const filePath = current.photoPath ? path.join(uploadDir, path.basename(current.photoPath)) : null;

  await prisma.commonerLicense.delete({ where: { id } });
  await removeFileIfExists(filePath);
};

const VALID_STATUSES = ["Sin entregar", "Entregado"];

const updateCommonerLicenseStatus = async (id, status) => {
  if (!VALID_STATUSES.includes(status)) {
    throw new HttpError(400, `Estado invalido. Valores permitidos: ${VALID_STATUSES.join(", ")}`);
  }

  const current = await prisma.commonerLicense.findUnique({ where: { id } });

  if (!current) {
    throw new HttpError(404, "Carnet de comunero no encontrado");
  }

  const updated = await prisma.commonerLicense.update({
    where: { id },
    data: { status },
  });

  return formatCommonerLicenseResponse(updated);
};

module.exports = {
  listCommonerLicenses,
  listAllCommonerLicenses,
  getCommonerLicenseById,
  searchCommonerLicenses,
  createCommonerLicense,
  deleteCommonerLicense,
  updateCommonerLicenseStatus,
};
