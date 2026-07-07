const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

async function seedAssemblyRecordRequests(prisma, api) {
  const existingCount = await prisma.assemblyRecordRequest.count();
  if (existingCount > 0 && !process.env.FORCE_SEEDS) {
    console.log(`  ℹ ${existingCount} solicitudes de acta ya existen, saltando`);
    return;
  }

  let docs;
  try {
    docs = await api.listAll("/api/assembly-record-requests", { limit: 100 });
  } catch (err) {
    console.warn(`  ⚠ Could not fetch assembly record requests: ${err.message}`);
    return;
  }

  if (!Array.isArray(docs) || docs.length === 0) {
    console.log("  ℹ No assembly record requests to import");
    return;
  }

  const existingCodes = new Set((await prisma.assemblyRecordRequest.findMany({ select: { code: true } })).map((row) => row.code));

  let imported = 0;
  let skipped = 0;

  for (const doc of docs) {
    const code = String(doc.code || doc._id || "").trim();
    if (!code || existingCodes.has(code)) {
      skipped++;
      continue;
    }

    const clientId = Number(doc.client?.id);
    const certificateId = Number(doc.certificate?.id);
    if (!clientId || !certificateId) {
      skipped++;
      console.warn(`  ⚠ Datos incompletos para acta ${code}`);
      continue;
    }

    try {
      await prisma.assemblyRecordRequest.create({
        data: {
          code,
          client: { connect: { id: clientId } },
          certificate: { connect: { id: certificateId } },
          user: doc.user?.id ? { connect: { id: doc.user.id } } : undefined,
          description: doc.description?.trim() || null,
          buyerFullName: doc.buyerFullName?.trim() || null,
          sellerFullName: doc.sellerFullName?.trim() || null,
          sectorLocation: doc.sectorLocation?.trim() || null,
          terrainType: doc.terrainType?.trim() || null,
          awardDate: parseDate(doc.awardDate),
          possessionTime: doc.possessionTime?.trim() || null,
          email: doc.email?.trim() || null,
          phone: doc.phone?.trim() || null,
          attachments: doc.attachments || [],
          legacyPayload: doc,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt),
        },
      });
      existingCodes.add(code);
      imported++;
    } catch (err) {
      skipped++;
      console.warn(`  ⚠ Error importing request "${code}": ${err.message}`);
    }
  }

  console.log(`  ✓ ${imported} solicitudes de acta importadas, ${skipped} omitidas`);
}

module.exports = { seedAssemblyRecordRequests };
