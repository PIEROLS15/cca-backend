const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const { makeDeletionPreview, makeImpactItem } = require("../../../utils/deletion-preview");
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

const getSectorDeletePreview = async (id) => {
  const sector = await prisma.sector.findUnique({
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

  if (!sector) {
    throw new HttpError(404, "Sector no encontrado");
  }

  return makeDeletionPreview({
    entityLabel: "sector",
    itemName: sector.name,
    willBlock: sector._count.certificates > 0
      ? [makeImpactItem({ label: "Certificados asociados", count: sector._count.certificates })]
      : [],
  });
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

const deleteSector = async (id) => {
  const preview = await getSectorDeletePreview(id);
  if (!preview.canDelete) {
    throw new HttpError(409, "No se puede eliminar el sector porque tiene certificados asociados");
  }

  try {
    await prisma.sector.delete({ where: { id } });
  } catch (error) {
    if (error?.code === "P2003") {
      throw new HttpError(409, "No se puede eliminar el sector porque tiene certificados asociados");
    }

    throw error;
  }
};

module.exports = {
  listSectors,
  getSectorById,
  getSectorDeletePreview,
  createSector,
  updateSector,
  deleteSector,
};
