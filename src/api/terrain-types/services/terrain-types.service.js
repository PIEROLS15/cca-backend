const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const {
  DEFAULT_TERRAIN_TYPE_CONFIG_KEY,
  resolveTerrainTypeConfigKey,
} = require("../../../constants/terrain-type-configs");
const { normalizeName, formatTerrainTypeResponse } = require("../utils/terrain-types.utils");

const terrainTypeInclude = {
  config: true,
};

const findTerrainTypeConfigId = async (name, explicitConfigId) => {
  if (explicitConfigId !== undefined && explicitConfigId !== null) {
    const config = await prisma.terrainTypeConfig.findUnique({ where: { id: Number(explicitConfigId) } });
    if (!config) {
      throw new HttpError(404, "Configuración de tipo de terreno no encontrada");
    }
    return config.id;
  }

  const configKey = resolveTerrainTypeConfigKey(name) || DEFAULT_TERRAIN_TYPE_CONFIG_KEY;
  const config = await prisma.terrainTypeConfig.findUnique({ where: { key: configKey } });
  if (!config) {
    throw new HttpError(500, "No se encontró la configuración por defecto del tipo de terreno");
  }

  return config.id;
};

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
      include: terrainTypeInclude,
      orderBy: { id: "desc" },
      skip,
      take: limit,
    }),
    prisma.terrainType.count({ where }),
  ]);

  return buildPaginationResult({
    docs: docs.map(formatTerrainTypeResponse),
    total,
    page,
    limit,
  });
};

const getTerrainTypeById = async (id) => {
  const terrainType = await prisma.terrainType.findUnique({ where: { id }, include: terrainTypeInclude });
  if (!terrainType) {
    throw new HttpError(404, "Tipo de terreno no encontrado");
  }
  return formatTerrainTypeResponse(terrainType);
};

const createTerrainType = async ({ name, terrainTypeConfigId }) => {
  const normalizedName = normalizeName(name);
  const configId = await findTerrainTypeConfigId(normalizedName, terrainTypeConfigId);

  const terrainType = await prisma.terrainType.create({
    data: {
      name: normalizedName,
      terrainTypeConfigId: configId,
    },
    include: terrainTypeInclude,
  });

  return formatTerrainTypeResponse(terrainType);
};

const updateTerrainType = async (id, { name, terrainTypeConfigId }) => {
  const existing = await prisma.terrainType.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, "Tipo de terreno no encontrado");
  }

  const normalizedName = name ? normalizeName(name) : existing.name;
  const configId = await findTerrainTypeConfigId(normalizedName, terrainTypeConfigId ?? existing.terrainTypeConfigId);

  const terrainType = await prisma.terrainType.update({
    where: { id },
    data: {
      name: normalizedName,
      terrainTypeConfigId: configId,
    },
    include: terrainTypeInclude,
  });

  return formatTerrainTypeResponse(terrainType);
};

module.exports = {
  listTerrainTypes,
  getTerrainTypeById,
  createTerrainType,
  updateTerrainType,
};
