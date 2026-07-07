const STATUS_MAP = {
  "por firmar": "PorFirmar",
  "por recoger": "PorRecoger",
  entregado: "Entregado",
};

const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const normalizeDni = (value) => String(value || "").trim();

async function seedCertificates(prisma, api) {
  const existingCount = await prisma.certificate.count();
  if (existingCount > 0 && !process.env.FORCE_SEEDS) {
    console.log(`  ℹ ${existingCount} certificados ya existen, saltando`);
    return;
  }

  console.log("  ℹ Colectando certificados desde la API actual...");

  let docs;
  try {
    docs = await api.listAll("/api/certificates", { limit: 100 });
  } catch (err) {
    console.warn(`  ⚠ Could not fetch certificates: ${err.message}`);
    return;
  }

  if (!Array.isArray(docs) || docs.length === 0) {
    console.log("  ℹ No certificates to import");
    return;
  }

  const userByDni = await prisma.user.findMany({ select: { id: true, dni: true } }).then((rows) => {
    const map = new Map();
    for (const row of rows) {
      if (row.dni) map.set(normalizeDni(row.dni), row.id);
    }
    return map;
  });

  const requestByNumber = await prisma.certificateRequest.findMany({ select: { id: true, requestNumber: true } }).then((rows) => {
    const map = new Map();
    for (const row of rows) {
      map.set(String(row.requestNumber).trim(), row.id);
    }
    return map;
  });

  const fallbackUser = await prisma.user.findUnique({
    where: { username: "pierols" },
    select: { id: true },
  });
  if (!fallbackUser) {
    throw new Error('Usuario local "pierols" no encontrado');
  }

  const existingNumbers = new Set((await prisma.certificate.findMany({ select: { certificateNumber: true } })).map((row) => row.certificateNumber));

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  const buildCertificateData = ({ certificateNumber, doc, owners, userId, status }) => {
    const terrain = doc.terrain || {};
    const location = doc.location || {};
    const data = {
      certificateNumber,
      requestNumber: String(doc.requestNumber || "").trim(),
      client: { connect: { id: owners[0].id } },
      sector: location.sectors?.id ? { connect: { id: location.sectors.id } } : undefined,
      terrainType: terrain.terrainType?.id ? { connect: { id: terrain.terrainType.id } } : undefined,
      user: userId ? { connect: { id: userId } } : undefined,
      width: terrain.width ?? null,
      length: terrain.length ?? null,
      totalArea: terrain.totalArea ?? null,
      area: terrain.area ?? null,
      perimeter: terrain.perimeter ?? null,
      additionalWidth: terrain.additionalWidth ?? null,
      additionalLength: terrain.additionalLength ?? null,
      measurementModeUsed: terrain.measurementModeUsed || "RECTANGULAR_AUTO",
      mz: location.mz || null,
      lot: location.lot || null,
      north: doc.borders?.north || null,
      south: doc.borders?.south || null,
      east: doc.borders?.east || null,
      west: doc.borders?.west || null,
      legacyPayload: doc,
      issuedSnapshot: doc.issuedSnapshot || null,
      status,
      createdAt: parseDate(doc.createdAt),
      updatedAt: parseDate(doc.updatedAt),
    };

    if (owners[1]?.id) {
      data.partner = { connect: { id: owners[1].id } };
    }

    return data;
  };

  for (const doc of docs) {
    const certificateNumber = String(doc.certificateNumber || "").trim();
    if (!certificateNumber) {
      skipped++;
      continue;
    }

    const owners = Array.isArray(doc.owners) ? doc.owners : [];
    if (!owners.length || !owners[0]?.id) {
      skipped++;
      console.warn(`  ⚠ Sin propietario principal: certificado ${certificateNumber}`);
      continue;
    }

    const requestNumber = String(doc.requestNumber || "").trim();
    const userId = doc.createdBy?.dni ? userByDni.get(normalizeDni(doc.createdBy.dni)) || fallbackUser.id : fallbackUser.id;
    const status = STATUS_MAP[String(doc.status || "").toLowerCase()] || "PorFirmar";
    const wasExisting = existingNumbers.has(certificateNumber);
    const certificateData = buildCertificateData({ certificateNumber, doc, owners, userId, status });

    const localRequestId = requestByNumber.get(requestNumber);
    if (localRequestId) {
      certificateData.certificateRequest = { connect: { id: localRequestId } };
    }

    try {
      await prisma.$transaction(async (tx) => {
        const certificate = wasExisting
          ? await tx.certificate.update({
              where: { certificateNumber },
              data: certificateData,
              select: { id: true },
            })
          : await tx.certificate.create({
              data: certificateData,
              select: { id: true },
            });

        await tx.certificateOwner.deleteMany({ where: { certificateId: certificate.id } });
        await tx.certificateOwner.createMany({
          data: owners.map((owner, index) => ({
            certificateId: certificate.id,
            clientId: owner.id,
            order: index + 1,
            source: owner.source || "certificate.owner",
          })),
        });
      });

      existingNumbers.add(certificateNumber);
      if (wasExisting) updated++;
      else imported++;
    } catch (err) {
      skipped++;
      console.warn(`  ⚠ Error importing certificate "${certificateNumber}": ${err.message}`);
    }
  }

  console.log(`  ✓ ${imported} certificados importados, ${updated} actualizados, ${skipped} omitidos`);
}

module.exports = { seedCertificates };
