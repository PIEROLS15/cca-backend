const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const normalizeName = (value) => (value === null || value === undefined ? null : String(value).trim() || null);

const syncTerrainTypeConfigs = async (prisma, remoteTypes) => {
  const configsByKey = new Map();
  const configList = [];

  for (const item of remoteTypes) {
    const config = item?.config;
    if (!config?.key) {
      continue;
    }

    if (configsByKey.has(config.key)) {
      continue;
    }

    configsByKey.set(config.key, config);
    configList.push(config);
  }

  const existingConfigs = await prisma.terrainTypeConfig.findMany({
    select: {
      id: true,
      key: true,
      _count: {
        select: {
          terrainTypes: true,
        },
      },
    },
  });

  const existingById = new Map(existingConfigs.map((config) => [config.id, config]));
  const existingByKey = new Map(existingConfigs.map((config) => [config.key, config]));
  const remoteConfigIds = new Set();

  let imported = 0;
  let updated = 0;
  let deleted = 0;
  let skipped = 0;

  for (const config of configList) {
    const id = Number(config.id);
    const key = normalizeName(config.key);
    if (!id || !key) {
      skipped++;
      continue;
    }

    remoteConfigIds.add(id);

    const byId = existingById.get(id) || null;
    const byKey = !byId ? existingByKey.get(key) || null : null;

    if (byKey && byKey.id !== id) {
      if (byKey._count.terrainTypes > 0) {
        console.warn(`  ⚠ No se pudo recrear la configuracion #${id} "${key}" porque el registro local equivalente tiene ${byKey._count.terrainTypes} tipos de terreno asociados`);
        skipped++;
        continue;
      }

      await prisma.terrainTypeConfig.delete({ where: { id: byKey.id } });
      existingById.delete(byKey.id);
      existingByKey.delete(byKey.key);
    }

    try {
      await prisma.terrainTypeConfig.upsert({
        where: { id },
        create: {
          id,
          key,
          label: normalizeName(config.label) || key,
          formMode: config.formMode,
          showMzLot: Boolean(config.showMzLot),
          allowAdditionalMeasure: Boolean(config.allowAdditionalMeasure),
          allowAreaPerimeterToggle: Boolean(config.allowAreaPerimeterToggle),
          createdAt: parseDate(config.createdAt),
          updatedAt: parseDate(config.updatedAt),
        },
        update: {
          key,
          label: normalizeName(config.label) || key,
          formMode: config.formMode,
          showMzLot: Boolean(config.showMzLot),
          allowAdditionalMeasure: Boolean(config.allowAdditionalMeasure),
          allowAreaPerimeterToggle: Boolean(config.allowAreaPerimeterToggle),
          createdAt: parseDate(config.createdAt),
          updatedAt: parseDate(config.updatedAt),
        },
      });
    } catch (err) {
      if (err?.code === "P2002") {
        console.warn(`  ⚠ Duplicado detectado en configuracion #${id} "${key}". Campo unico afectado: ${Array.isArray(err?.meta?.target) ? err.meta.target.join(", ") : err?.meta?.target || "desconocido"}`);
      }

      skipped++;
      console.warn(`  ⚠ No se pudo importar la configuracion #${id} "${key}": ${err.message}`);
      continue;
    }

    if (byId || byKey) {
      updated++;
    } else {
      imported++;
    }

    console.log(`  ✓ Configuracion #${id} "${key}"`);
  }

  for (const config of existingConfigs) {
    if (remoteConfigIds.has(config.id)) {
      continue;
    }

    if (config._count.terrainTypes > 0) {
      console.warn(`  ⚠ No se eliminó la configuracion #${config.id} "${config.key}" porque tiene ${config._count.terrainTypes} tipos de terreno asociados`);
      skipped++;
      continue;
    }

    await prisma.terrainTypeConfig.delete({ where: { id: config.id } });
    deleted++;
    console.log(`  ✓ Configuracion eliminada #${config.id} "${config.key}"`);
  }

  return { imported, updated, deleted, skipped, configIdByKey: configsByKey };
};

async function seedTerrainTypes(prisma, api) {
  let remoteTypes;

  try {
    remoteTypes = await api.listAll("/api/terrain-types", { limit: 100 });

    if (!Array.isArray(remoteTypes) || remoteTypes.length === 0) {
      console.log("  ℹ No hay tipos de terreno para importar");
      return;
    }
  } catch (err) {
    console.warn(`  ⚠ No se pudieron obtener los tipos de terreno: ${err.message}`);
    return;
  }

  const { configIdByKey } = await syncTerrainTypeConfigs(prisma, remoteTypes);

  const existingTypes = await prisma.terrainType.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          certificates: true,
        },
      },
    },
  });

  const existingById = new Map(existingTypes.map((type) => [type.id, type]));
  const existingByName = new Map(existingTypes.map((type) => [type.name, type]));
  const remoteIds = new Set();

  let imported = 0;
  let updated = 0;
  let deleted = 0;
  let skipped = 0;

  for (const raw of remoteTypes) {
    const id = Number(raw?.id);
    const name = normalizeName(raw?.name);
    const config = raw?.config;
    const terrainTypeConfigId = config?.id ? Number(config.id) : null;

    if (!id || !name || !terrainTypeConfigId) {
      skipped++;
      continue;
    }

    remoteIds.add(id);

    const byId = existingById.get(id) || null;
    const byName = !byId ? existingByName.get(name) || null : null;

    if (byName && byName.id !== id) {
      if (byName._count.certificates > 0) {
        console.warn(`  ⚠ No se pudo recrear el tipo de terreno #${id} "${name}" porque el registro local equivalente tiene ${byName._count.certificates} certificados asociados`);
        skipped++;
        continue;
      }

      await prisma.terrainType.delete({ where: { id: byName.id } });
      existingById.delete(byName.id);
      existingByName.delete(byName.name);
    }

    try {
      await prisma.terrainType.upsert({
        where: { id },
        create: {
          id,
          name,
          terrainTypeConfigId: configIdByKey.get(config.key)?.id ?? terrainTypeConfigId,
          createdAt: parseDate(raw.createdAt),
          updatedAt: parseDate(raw.updatedAt),
        },
        update: {
          name,
          terrainTypeConfigId: configIdByKey.get(config.key)?.id ?? terrainTypeConfigId,
          createdAt: parseDate(raw.createdAt),
          updatedAt: parseDate(raw.updatedAt),
        },
      });
    } catch (err) {
      if (err?.code === "P2002") {
        console.warn(`  ⚠ Duplicado detectado en tipo de terreno #${id} "${name}". Campo unico afectado: ${Array.isArray(err?.meta?.target) ? err.meta.target.join(", ") : err?.meta?.target || "desconocido"}`);
      }

      skipped++;
      console.warn(`  ⚠ No se pudo importar el tipo de terreno #${id} "${name}": ${err.message}`);
      continue;
    }

    if (byId || byName) {
      updated++;
    } else {
      imported++;
    }

    console.log(`  ✓ Tipo de terreno #${id} "${name}"`);
  }

  for (const terrainType of existingTypes) {
    if (remoteIds.has(terrainType.id)) {
      continue;
    }

    if (terrainType._count.certificates > 0) {
      console.warn(`  ⚠ No se eliminó el tipo de terreno #${terrainType.id} "${terrainType.name}" porque tiene ${terrainType._count.certificates} certificados asociados`);
      skipped++;
      continue;
    }

    await prisma.terrainType.delete({ where: { id: terrainType.id } });
    deleted++;
    console.log(`  ✓ Tipo de terreno eliminado #${terrainType.id} "${terrainType.name}"`);
  }

  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"TerrainTypeConfig"', 'id'), COALESCE((SELECT MAX(id) FROM "TerrainTypeConfig"), 1), true)`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"TerrainType"', 'id'), COALESCE((SELECT MAX(id) FROM "TerrainType"), 1), true)`);

  console.log(`  ✓ ${imported} tipos de terreno importados, ${updated} actualizados, ${deleted} eliminados, ${skipped} omitidos`);
}

module.exports = { seedTerrainTypes };
