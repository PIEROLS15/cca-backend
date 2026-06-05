const API_URL = `${process.env.API_BASE_URL}/backend-certificado/sector-location/combo`;
const BEARER_TOKEN = process.env.BEARER_TOKEN;

async function seedSectors(prisma) {
  let remoteSectors;

  try {
    const res = await fetch(API_URL, {
      headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`  ⚠ API responded with ${res.status}${body ? ": " + body.slice(0, 150) : ""}, skipping`);
      return;
    }

    remoteSectors = await res.json();

    remoteSectors = remoteSectors?.data;

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
        createdAt: new Date(raw.createdAt),
        updatedAt: new Date(raw.updatedAt),
      },
    });
    imported++;
  }

  console.log(`  ✓ ${imported} sectores importados${imported < remoteSectors.length ? ` (${remoteSectors.length - imported} ya existentes)` : ""}`);
}

module.exports = { seedSectors };
