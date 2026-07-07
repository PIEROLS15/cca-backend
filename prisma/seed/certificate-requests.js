const { Prisma } = require("@prisma/client");

const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const normalizeDni = (value) => String(value || "").trim();

const normalizeText = (value) => (value === null || value === undefined ? null : String(value).trim() || null);

const shiftDateForLocalStorage = (value) => {
  const date = parseDate(value);
  return new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
};

const jsonbFragment = (value) => {
  if (value === null || value === undefined) {
    return Prisma.sql`NULL`;
  }

  return Prisma.sql`${JSON.stringify(value)}::jsonb`;
};

const upsertCertificateRequestRaw = async (tx, record) => {
  await tx.$executeRaw`
    INSERT INTO "CertificateRequest" (
      "id",
      "requestNumber",
      "clientId",
      "userId",
      "partnerId",
      "description",
      "destination",
      "requestDescription",
      "sectorLocation",
      "certificateTypes",
      "exposure",
      "attachments",
      "legacyPayload",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${record.id},
      ${record.requestNumber},
      ${record.clientId},
      ${record.userId},
      ${record.partnerId},
      ${record.description},
      ${record.destination},
      ${record.requestDescription},
      ${record.sectorLocation},
      ${jsonbFragment(record.certificateTypes)},
      ${record.exposure},
      ${jsonbFragment(record.attachments)},
      ${jsonbFragment(null)},
      ${record.createdAt},
      ${record.updatedAt}
    )
    ON CONFLICT ("id") DO UPDATE SET
      "requestNumber" = EXCLUDED."requestNumber",
      "clientId" = EXCLUDED."clientId",
      "userId" = EXCLUDED."userId",
      "partnerId" = EXCLUDED."partnerId",
      "description" = EXCLUDED."description",
      "destination" = EXCLUDED."destination",
      "requestDescription" = EXCLUDED."requestDescription",
      "sectorLocation" = EXCLUDED."sectorLocation",
      "certificateTypes" = EXCLUDED."certificateTypes",
      "exposure" = EXCLUDED."exposure",
      "attachments" = EXCLUDED."attachments",
      "legacyPayload" = EXCLUDED."legacyPayload",
      "createdAt" = EXCLUDED."createdAt",
      "updatedAt" = EXCLUDED."updatedAt";
  `;
};

async function seedCertificateRequests(prisma, api) {
  let docs;
  try {
    docs = await api.listAll("/api/certificate-requests", { limit: 100 });
  } catch (err) {
    console.warn(`  ⚠ No se pudieron obtener las solicitudes de certificado: ${err.message}`);
    return;
  }

  if (!Array.isArray(docs) || docs.length === 0) {
    console.log("  ℹ No hay solicitudes de certificado para importar");
    return;
  }

  const users = await prisma.user.findMany({ select: { id: true, dni: true } });
  const userByDni = new Map();
  for (const user of users) {
    if (user.dni) {
      userByDni.set(normalizeDni(user.dni), user.id);
    }
  }

  const existingRequests = await prisma.certificateRequest.findMany({
    select: {
      id: true,
      requestNumber: true,
      _count: {
        select: {
          certificates: true,
        },
      },
    },
  });

  const existingById = new Map(existingRequests.map((request) => [request.id, request]));
  const existingByNumber = new Map(existingRequests.map((request) => [request.requestNumber, request]));
  const remoteIds = new Set();

  let imported = 0;
  let updated = 0;
  let deleted = 0;
  let skipped = 0;

  for (const doc of docs) {
    const id = Number(doc?.id);
    const requestNumber = normalizeText(doc?.requestNumber);
    if (!id || !requestNumber) {
      skipped++;
      continue;
    }

    remoteIds.add(id);

    const clientId = Number(doc?.client?.id);
    if (!clientId) {
      skipped++;
      console.warn(`  ⚠ No se encontró el cliente para la solicitud #${id} "${requestNumber}"`);
      continue;
    }

    const partnerId = Number(doc?.partnerClient?.id) || null;
    const userId = doc?.createdBy?.dni ? userByDni.get(normalizeDni(doc.createdBy.dni)) || null : null;
    const wasExisting = existingById.has(id) || existingByNumber.has(requestNumber);
    const conflictByNumber = existingByNumber.get(requestNumber) || null;

    if (conflictByNumber && conflictByNumber.id !== id) {
      if (conflictByNumber._count.certificates > 0) {
        skipped++;
        console.warn(`  ⚠ No se pudo recrear la solicitud de certificado #${id} "${requestNumber}" porque la fila local equivalente #${conflictByNumber.id} tiene ${conflictByNumber._count.certificates} certificados asociados`);
        continue;
      }

      await prisma.certificateRequest.delete({ where: { id: conflictByNumber.id } });
      existingById.delete(conflictByNumber.id);
      existingByNumber.delete(conflictByNumber.requestNumber);
    }

    const record = {
      id,
      requestNumber,
      clientId,
      userId,
      partnerId,
      description: normalizeText(doc.description) || normalizeText(doc.requestDescription),
      requestDescription: normalizeText(doc.requestDescription) || normalizeText(doc.description),
      destination: normalizeText(doc.destination),
      exposure: normalizeText(doc.exposure),
      sectorLocation: normalizeText(doc.sectorLocation),
      certificateTypes: doc.certificateTypes || [],
      attachments: doc.attachments || [],
      createdAt: shiftDateForLocalStorage(doc.createdAt),
      updatedAt: shiftDateForLocalStorage(doc.updatedAt),
    };

    try {
      await prisma.$transaction(async (tx) => {
        await upsertCertificateRequestRaw(tx, record);
      });

      if (wasExisting) {
        updated++;
      } else {
        imported++;
      }

      console.log(`  ✓ Solicitud de certificado #${id} "${requestNumber}"`);
    } catch (err) {
      if (err?.code === "P2002") {
        console.warn(`  ⚠ Duplicado detectado en solicitud #${id} "${requestNumber}". Campo único afectado: ${Array.isArray(err?.meta?.target) ? err.meta.target.join(", ") : err?.meta?.target || "desconocido"}`);
      }

      skipped++;
      console.warn(`  ⚠ No se pudo importar la solicitud de certificado #${id} "${requestNumber}": ${err.message}`);
    }
  }

  for (const request of existingRequests) {
    if (remoteIds.has(request.id)) {
      continue;
    }

    if (request._count.certificates > 0) {
      console.warn(`  ⚠ No se eliminó la solicitud de certificado #${request.id} "${request.requestNumber}" porque tiene ${request._count.certificates} certificados asociados`);
      skipped++;
      continue;
    }

    await prisma.certificateRequest.delete({ where: { id: request.id } });
    deleted++;
    console.log(`  ✓ Solicitud de certificado eliminada #${request.id} "${request.requestNumber}"`);
  }

  await prisma.$executeRaw`
    SELECT setval(
      pg_get_serial_sequence('"CertificateRequest"', 'id'),
      COALESCE((SELECT MAX("id") FROM "CertificateRequest"), 1),
      (SELECT COUNT(*) > 0 FROM "CertificateRequest")
    );
  `;

  console.log(`  ✓ ${imported} solicitudes importadas, ${updated} actualizadas, ${deleted} eliminadas, ${skipped} omitidas`);
}

module.exports = { seedCertificateRequests };
