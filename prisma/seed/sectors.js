const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

async function seedSectors(prisma, api) {
  let remoteSectors;

  try {
    remoteSectors = await api.listAll("/api/sectors", { limit: 100 });

    if (!Array.isArray(remoteSectors) || remoteSectors.length === 0) {
      console.log("  ℹ No sectors to import");
      return;
    }
  } catch (err) {
    console.warn(`  ⚠ Could not fetch sectors: ${err.message}`);
    return;
  }

  let imported = 0;
  for (const raw of remoteSectors) {
    if (!raw.name) continue;

    const exists = await prisma.sector.findUnique({ where: { name: raw.name } });
    if (exists) continue;

    await prisma.sector.create({
      data: {
        name: raw.name,
        createdAt: parseDate(raw.createdAt),
        updatedAt: parseDate(raw.updatedAt),
      },
    });
    imported++;
  }

  console.log(`  ✓ ${imported} sectores importados${imported < remoteSectors.length ? ` (${remoteSectors.length - imported} ya existentes)` : ""}`);
}

module.exports = { seedSectors };
