const API_URL = `${process.env.API_BASE_URL}/backend-certificado/terrain-type/combo`;
const BEARER_TOKEN = process.env.BEARER_TOKEN;

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

  let imported = 0;
  for (const raw of remoteTypes) {
    if (!raw.name) continue;

    const exists = await prisma.terrainType.findUnique({ where: { name: raw.name } });
    if (exists) continue;

    await prisma.terrainType.create({
      data: {
        name: raw.name,
        createdAt: new Date(raw.createdAt),
        updatedAt: new Date(raw.updatedAt),
      },
    });
    imported++;
  }

  console.log(`  ✓ ${imported} tipos de terreno importados${imported < remoteTypes.length ? ` (${remoteTypes.length - imported} ya existentes)` : ""}`);
}

module.exports = { seedTerrainTypes };
