const {
  TERRAIN_TYPE_CONFIG_DEFINITIONS,
  resolveTerrainTypeConfigKey,
} = require("../../src/constants/terrain-type-configs");

const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

async function ensureTerrainTypeConfigs(prisma) {
  for (const config of TERRAIN_TYPE_CONFIG_DEFINITIONS) {
    await prisma.terrainTypeConfig.upsert({
      where: { key: config.key },
      create: config,
      update: {
        label: config.label,
        formMode: config.formMode,
        showMzLot: config.showMzLot,
        allowAdditionalMeasure: config.allowAdditionalMeasure,
        allowAreaPerimeterToggle: config.allowAreaPerimeterToggle,
      },
    });
  }

  const configs = await prisma.terrainTypeConfig.findMany({ select: { id: true, key: true } });
  return new Map(configs.map((config) => [config.key, config.id]));
}

async function seedTerrainTypes(prisma, api) {
  let remoteTypes;

  try {
    remoteTypes = await api.listAll("/api/terrain-types", { limit: 100 });

    if (!Array.isArray(remoteTypes) || remoteTypes.length === 0) {
      console.log("  ℹ No terrain types to import");
      return;
    }
  } catch (err) {
    console.warn(`  ⚠ Could not fetch terrain types: ${err.message}`);
    return;
  }

  const configIdByKey = await ensureTerrainTypeConfigs(prisma);

  let imported = 0;
  for (const raw of remoteTypes) {
    if (!raw.name) continue;

    const configKey = resolveTerrainTypeConfigKey(raw.name);
    const terrainTypeConfigId = configIdByKey.get(configKey) || null;

    const exists = await prisma.terrainType.findUnique({ where: { name: raw.name } });
    if (exists) {
      if (exists.terrainTypeConfigId !== terrainTypeConfigId) {
        await prisma.terrainType.update({
          where: { id: exists.id },
          data: { terrainTypeConfigId },
        });
      }
      continue;
    }

    await prisma.terrainType.create({
      data: {
        name: raw.name,
        terrainTypeConfigId,
        createdAt: parseDate(raw.createdAt),
        updatedAt: parseDate(raw.updatedAt),
      },
    });
    imported++;
  }

  console.log(`  ✓ ${imported} tipos de terreno importados${imported < remoteTypes.length ? ` (${remoteTypes.length - imported} ya existentes)` : ""}`);
}

module.exports = { seedTerrainTypes };
