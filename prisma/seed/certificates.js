const { Prisma } = require("@prisma/client");

const STATUS_MAP = {
  recepcionado: "Recepcionado",
  "por firmar": "PorFirmar",
  "por recoger": "PorRecoger",
  entregado: "Entregado",
  observado: "Observado",
};

const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const shiftDateForLocalStorage = (value) => {
  const date = parseDate(value);
  return new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
};

const normalizeDni = (value) => String(value || "").trim();

const normalizeText = (value) => (value === null || value === undefined ? null : String(value).trim() || null);

const jsonbFragment = (value) => {
  if (value === null || value === undefined) {
    return Prisma.sql`NULL`;
  }

  return Prisma.sql`${JSON.stringify(value)}::jsonb`;
};

const resetCertificatesTables = async (prisma) => {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM "AssemblyRecordRequest";`;
    await tx.$executeRaw`DELETE FROM "Certificate";`;
  });
};

const importCertificateRaw = async (tx, record) => {
  await tx.$executeRaw`
    INSERT INTO "Certificate" (
      "id",
      "certificateNumber",
      "verificationToken",
      "requestNumber",
      "certificateRequestId",
      "clientId",
      "partnerId",
      "sectorId",
      "terrainTypeId",
      "userId",
      "width",
      "length",
      "totalArea",
      "area",
      "perimeter",
      "additionalWidth",
      "additionalLength",
      "measurementModeUsed",
      "legacyPayload",
      "issuedSnapshot",
      "mz",
      "lot",
      "north",
      "south",
      "east",
      "west",
      "status",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${record.id},
      ${record.certificateNumber},
      ${record.verificationToken},
      ${record.requestNumber},
      ${record.certificateRequestId},
      ${record.clientId},
      ${record.partnerId},
      ${record.sectorId},
      ${record.terrainTypeId},
      ${record.userId},
      ${record.width},
      ${record.length},
      ${record.totalArea},
      ${record.area},
      ${record.perimeter},
      ${record.additionalWidth},
      ${record.additionalLength},
      ${record.measurementModeUsed}::"TerrainMeasurementMode",
      ${jsonbFragment(record.legacyPayload)},
      ${jsonbFragment(record.issuedSnapshot)},
      ${record.mz},
      ${record.lot},
      ${record.north},
      ${record.south},
      ${record.east},
      ${record.west},
      ${record.status}::"CertificateStatus",
      ${record.createdAt},
      ${record.updatedAt}
    )
    ON CONFLICT ("id") DO UPDATE SET
      "certificateNumber" = EXCLUDED."certificateNumber",
      "verificationToken" = EXCLUDED."verificationToken",
      "requestNumber" = EXCLUDED."requestNumber",
      "certificateRequestId" = EXCLUDED."certificateRequestId",
      "clientId" = EXCLUDED."clientId",
      "partnerId" = EXCLUDED."partnerId",
      "sectorId" = EXCLUDED."sectorId",
      "terrainTypeId" = EXCLUDED."terrainTypeId",
      "userId" = EXCLUDED."userId",
      "width" = EXCLUDED."width",
      "length" = EXCLUDED."length",
      "totalArea" = EXCLUDED."totalArea",
      "area" = EXCLUDED."area",
      "perimeter" = EXCLUDED."perimeter",
      "additionalWidth" = EXCLUDED."additionalWidth",
      "additionalLength" = EXCLUDED."additionalLength",
      "measurementModeUsed" = EXCLUDED."measurementModeUsed",
      "legacyPayload" = EXCLUDED."legacyPayload",
      "issuedSnapshot" = EXCLUDED."issuedSnapshot",
      "mz" = EXCLUDED."mz",
      "lot" = EXCLUDED."lot",
      "north" = EXCLUDED."north",
      "south" = EXCLUDED."south",
      "east" = EXCLUDED."east",
      "west" = EXCLUDED."west",
      "status" = EXCLUDED."status",
      "createdAt" = EXCLUDED."createdAt",
      "updatedAt" = EXCLUDED."updatedAt";
  `;
};

async function seedCertificates(prisma, api) {
  console.log("  ℹ Colectando certificados desde la API actual...");

  let docs;
  try {
    docs = await api.listAll("/api/certificates", { limit: 100 });
  } catch (err) {
    console.warn(`  ⚠ No se pudieron obtener los certificados: ${err.message}`);
    return;
  }

  if (!Array.isArray(docs) || docs.length === 0) {
    console.log("  ℹ No hay certificados para importar");
    return;
  }

  const users = await prisma.user.findMany({ select: { id: true, dni: true } });
  const userByDni = new Map();
  for (const row of users) {
    if (row.dni) {
      userByDni.set(normalizeDni(row.dni), row.id);
    }
  }

  const requests = await prisma.certificateRequest.findMany({ select: { id: true, requestNumber: true } });
  const requestByNumber = new Map();
  for (const row of requests) {
    requestByNumber.set(normalizeText(row.requestNumber), row.id);
  }

  const localClientIds = new Set(
    (await prisma.client.findMany({ select: { id: true } })).map((client) => client.id)
  );

  const fallbackUser = await prisma.user.findUnique({
    where: { username: "pierols" },
    select: { id: true },
  });
  if (!fallbackUser) {
    throw new Error('Usuario local "pierols" no encontrado');
  }

  await resetCertificatesTables(prisma);

  let imported = 0;
  let skipped = 0;

  for (const doc of docs) {
    const id = Number(doc?.id);
    const certificateNumber = normalizeText(doc?.certificateNumber);
    if (!id || !certificateNumber) {
      skipped++;
      continue;
    }

    const owners = Array.isArray(doc.owners) ? doc.owners : [];
    const ownerIds = owners
      .map((owner) => Number(owner?.id))
      .filter((ownerId) => Number.isFinite(ownerId));

    if (!ownerIds.length) {
      skipped++;
      console.warn(`  ⚠ Sin propietario principal: certificado ${certificateNumber}`);
      continue;
    }

    const missingOwnerIds = ownerIds.filter((ownerId) => !localClientIds.has(ownerId));
    if (missingOwnerIds.length > 0) {
      skipped++;
      console.warn(`  ⚠ El certificado #${id} "${certificateNumber}" referencia propietarios inexistentes en local: ${missingOwnerIds.join(", ")}`);
      continue;
    }

    const terrain = doc.terrain || {};
    const location = doc.location || {};
    const sectorId = Number(location.sectors?.id);
    const terrainTypeId = Number(terrain.terrainType?.id);

    if (!sectorId || !terrainTypeId) {
      skipped++;
      console.warn(`  ⚠ Datos incompletos para certificado #${id} "${certificateNumber}"`);
      continue;
    }

    const userId = doc.createdBy?.dni ? userByDni.get(normalizeDni(doc.createdBy.dni)) || null : null;
    const verificationToken = normalizeText(doc.verificationToken) || `cert-${id}`;
    const requestNumber = normalizeText(doc.requestNumber) || "";
    const certificateRequestId = Number(doc.certificateRequestId) || requestByNumber.get(requestNumber) || null;
    const status = STATUS_MAP[String(doc.status || "").toLowerCase()] || "PorFirmar";
    const measurementModeUsed = terrain.measurementModeUsed || "RECTANGULAR_AUTO";

    const record = {
      id,
      certificateNumber,
      verificationToken,
      requestNumber,
      certificateRequestId,
      clientId: ownerIds[0],
      partnerId: ownerIds[1] || null,
      sectorId,
      terrainTypeId,
      userId: userId || fallbackUser.id,
      width: terrain.width ?? null,
      length: terrain.length ?? null,
      totalArea: terrain.totalArea ?? null,
      area: terrain.area ?? null,
      perimeter: terrain.perimeter ?? null,
      additionalWidth: terrain.additionalWidth ?? null,
      additionalLength: terrain.additionalLength ?? null,
      measurementModeUsed,
      legacyPayload: doc.legacyPayload ?? null,
      issuedSnapshot: doc.issuedSnapshot ?? null,
      mz: normalizeText(location.mz),
      lot: normalizeText(location.lot),
      north: normalizeText(doc.borders?.north),
      south: normalizeText(doc.borders?.south),
      east: normalizeText(doc.borders?.east),
      west: normalizeText(doc.borders?.west),
      status,
      createdAt: shiftDateForLocalStorage(doc.createdAt),
      updatedAt: shiftDateForLocalStorage(doc.updatedAt),
    };

    try {
      await prisma.$transaction(async (tx) => {
        await importCertificateRaw(tx, record);

        await tx.certificateOwner.deleteMany({ where: { certificateId: id } });
        await tx.certificateOwner.createMany({
          data: owners.map((owner, index) => ({
            certificateId: id,
            clientId: Number(owner?.id),
            order: index + 1,
            source: owner.source || `owner-${index + 1}`,
          })).filter((owner) => Number.isFinite(owner.clientId)),
        });
      });

      imported++;

      console.log(`  ✓ Certificado #${id} "${certificateNumber}"`);
    } catch (err) {
      if (err?.code === "P2002") {
        console.warn(`  ⚠ Duplicado detectado en certificado #${id} "${certificateNumber}". Campo único afectado: ${Array.isArray(err?.meta?.target) ? err.meta.target.join(", ") : err?.meta?.target || "desconocido"}`);
      }

      skipped++;
      console.warn(`  ⚠ No se pudo importar el certificado #${id} "${certificateNumber}": ${err.message}`);
    }
  }

  await prisma.$executeRaw`
    SELECT setval(
      pg_get_serial_sequence('"Certificate"', 'id'),
      COALESCE((SELECT MAX("id") FROM "Certificate"), 1),
      (SELECT COUNT(*) > 0 FROM "Certificate")
    );
  `;

  console.log(`  ✓ ${imported} certificados importados, ${skipped} omitidos`);
}

module.exports = { seedCertificates };
