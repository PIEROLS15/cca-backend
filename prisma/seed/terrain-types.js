const API_URL = `${process.env.API_BASE_URL}/backend-certificado/terrain-type/combo`;
const BEARER_TOKEN = process.env.BEARER_TOKEN;
const {
  TERRAIN_TYPE_CONFIG_DEFINITIONS,
  resolveTerrainTypeConfigKey,
} = require("../../src/constants/terrain-type-configs");

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

async function seedTerrainTypes(prisma) {
  let remoteTypes;

  try {
    const res = await fetch(API_URL, {
      headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`  ⚠ API responded with ${res.status}${body ? ": " + body.slice(0, 150) : ""}, skipping`);
      return;
    }

    remoteTypes = await res.json();
    remoteTypes = remoteTypes?.data;

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
        createdAt: new Date(raw.createdAt),
        updatedAt: new Date(raw.updatedAt),
      },
    });
    imported++;
  }

  console.log(`  ✓ ${imported} tipos de terreno importados${imported < remoteTypes.length ? ` (${remoteTypes.length - imported} ya existentes)` : ""}`);
}

module.exports = { seedTerrainTypes };
