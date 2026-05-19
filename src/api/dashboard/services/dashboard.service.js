const prisma = require("../../../config/prisma");
const { toSummary } = require("../utils/dashboard.utils");

const getSummary = async () => {
  const [certificates, clients, terrainTypes, sectors] = await Promise.all([
    prisma.certificate.count(),
    prisma.client.count(),
    prisma.terrainType.count(),
    prisma.sector.count(),
  ]);

  return toSummary({ certificates, clients, terrainTypes, sectors });
};

module.exports = {
  getSummary,
};
