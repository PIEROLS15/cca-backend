const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const { makeDeletionPreview, makeImpactItem } = require("../../../utils/deletion-preview");
const {
  DEFAULT_TERRAIN_TYPE_CONFIG_KEY,
  resolveTerrainTypeConfigKey,
} = require("../../../constants/terrain-type-configs");
const { normalizeName, formatTerrainTypeResponse } = require("../utils/terrain-types.utils");

const canDeleteCatalogResource = (roleGroup) => [1, 2].includes(roleGroup);

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

const getTerrainTypeDeletePreview = async (id, roleGroup) => {
  if (!canDeleteCatalogResource(roleGroup)) {
    throw new HttpError(403, "No tienes permisos para eliminar tipos de terreno");
  }

  const terrainType = await prisma.terrainType.findUnique({
    where: { id },
    select: {
      name: true,
      _count: {
        select: {
          certificates: true,
        },
      },
    },
  });

  if (!terrainType) {
    throw new HttpError(404, "Tipo de terreno no encontrado");
  }

  return makeDeletionPreview({
    entityLabel: "tipo de terreno",
    itemName: terrainType.name,
    willBlock: terrainType._count.certificates > 0
      ? [makeImpactItem({ label: "Certificados asociados", count: terrainType._count.certificates })]
      : [],
  });
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

const deleteTerrainType = async (id, roleGroup) => {
  if (!canDeleteCatalogResource(roleGroup)) {
    throw new HttpError(403, "No tienes permisos para eliminar tipos de terreno");
  }

  const preview = await getTerrainTypeDeletePreview(id, roleGroup);
  if (!preview.canDelete) {
    throw new HttpError(409, "No se puede eliminar el tipo de terreno porque tiene certificados asociados");
  }

  try {
    await prisma.terrainType.delete({ where: { id } });
  } catch (error) {
    if (error?.code === "P2003") {
      throw new HttpError(409, "No se puede eliminar el tipo de terreno porque tiene certificados asociados");
    }

    throw error;
  }
};

module.exports = {
  listTerrainTypes,
  getTerrainTypeById,
  getTerrainTypeDeletePreview,
  createTerrainType,
  updateTerrainType,
  deleteTerrainType,
};
