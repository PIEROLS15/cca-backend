const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const { normalizeName } = require("../utils/terrain-types.utils");

const listTerrainTypes = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const { search } = query;

  const where = {};
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  const [docs, total] = await Promise.all([
    prisma.terrainType.findMany({
      where,
      orderBy: { id: "desc" },
      skip,
      take: limit,
    }),
    prisma.terrainType.count({ where }),
  ]);

  return buildPaginationResult({
    docs,
    total,
    page,
    limit,
  });
};

const getTerrainTypeById = async (id) => {
  const terrainType = await prisma.terrainType.findUnique({ where: { id } });
  if (!terrainType) {
    throw new HttpError(404, "Tipo de terreno no encontrado");
  }
  return terrainType;
};

const createTerrainType = async ({ name }) => {
  return prisma.terrainType.create({
    data: { name: normalizeName(name) },
  });
};

const updateTerrainType = async (id, { name }) => {
  await getTerrainTypeById(id);
  return prisma.terrainType.update({
    where: { id },
    data: { name: normalizeName(name) },
  });
};

const deleteTerrainType = async (id) => {
  await getTerrainTypeById(id);
  await prisma.terrainType.delete({ where: { id } });
};

module.exports = {
  listTerrainTypes,
  getTerrainTypeById,
  createTerrainType,
  updateTerrainType,
  deleteTerrainType,
};
