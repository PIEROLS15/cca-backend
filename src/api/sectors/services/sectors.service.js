const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const { normalizeName } = require("../utils/sectors.utils");

const listSectors = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const { search } = query;

  const where = {};
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  const [docs, total] = await Promise.all([
    prisma.sector.findMany({
      where,
      orderBy: { id: "desc" },
      skip,
      take: limit,
    }),
    prisma.sector.count({ where }),
  ]);

  return buildPaginationResult({
    docs,
    total,
    page,
    limit,
  });
};

const getSectorById = async (id) => {
  const sector = await prisma.sector.findUnique({ where: { id } });
  if (!sector) {
    throw new HttpError(404, "Sector no encontrado");
  }
  return sector;
};

const createSector = async ({ name }) => {
  return prisma.sector.create({
    data: { name: normalizeName(name) },
  });
};

const updateSector = async (id, { name }) => {
  await getSectorById(id);
  return prisma.sector.update({
    where: { id },
    data: { name: normalizeName(name) },
  });
};

module.exports = {
  listSectors,
  getSectorById,
  createSector,
  updateSector,
};
