const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const normalizeDni = (value) => String(value || "").trim();

async function seedCertificateRequests(prisma, api) {
  const existingCount = await prisma.certificateRequest.count();
  if (existingCount > 0 && !process.env.FORCE_SEEDS) {
    console.log(`  ℹ ${existingCount} solicitudes de certificado ya existen, saltando`);
    return;
  }

  let docs;
  try {
    docs = await api.listAll("/api/certificate-requests", { limit: 100 });
  } catch (err) {
    console.warn(`  ⚠ Could not fetch certificate requests: ${err.message}`);
    return;
  }

  if (!Array.isArray(docs) || docs.length === 0) {
    console.log("  ℹ No certificate requests to import");
    return;
  }

  const userByDni = await prisma.user.findMany({ select: { id: true, dni: true } }).then((users) => {
    const map = new Map();
    for (const user of users) {
      if (user.dni) map.set(normalizeDni(user.dni), user.id);
    }
    return map;
  });

  const existingNumbers = new Set((await prisma.certificateRequest.findMany({ select: { requestNumber: true } })).map((row) => row.requestNumber));

  let imported = 0;
  let skipped = 0;

  for (const doc of docs) {
    const requestNumber = String(doc.requestNumber || "").trim();
    if (!requestNumber || existingNumbers.has(requestNumber)) {
      skipped++;
      continue;
    }

    const clientId = Number(doc.client?.id);
    if (!clientId) {
      skipped++;
      console.warn(`  ⚠ Cliente no encontrado para solicitud ${requestNumber}`);
      continue;
    }

    const partnerId = Number(doc.partnerClient?.id) || null;
    const userId = doc.createdBy?.dni ? userByDni.get(normalizeDni(doc.createdBy.dni)) || null : null;

    try {
      await prisma.certificateRequest.create({
        data: {
          requestNumber,
          client: { connect: { id: clientId } },
          user: userId ? { connect: { id: userId } } : undefined,
          partner: partnerId ? { connect: { id: partnerId } } : undefined,
          description: doc.description?.trim() || doc.requestDescription?.trim() || null,
          requestDescription: doc.requestDescription?.trim() || doc.description?.trim() || null,
          destination: doc.destination?.trim() || null,
          exposure: doc.exposure?.trim() || null,
          sectorLocation: doc.sectorLocation?.trim() || null,
          certificateTypes: doc.certificateTypes || [],
          attachments: doc.attachments || [],
          legacyPayload: doc,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt),
        },
      });
      existingNumbers.add(requestNumber);
      imported++;
    } catch (err) {
      console.warn(`  ⚠ Error importing request "${requestNumber}": ${err.message}`);
    }
  }

  console.log(`  ✓ ${imported} solicitudes importadas, ${skipped} omitidas`);
}

module.exports = { seedCertificateRequests };
