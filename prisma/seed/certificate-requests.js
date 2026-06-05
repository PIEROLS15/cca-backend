const BEARER_TOKEN = process.env.BEARER_TOKEN;
const API_URL = `${process.env.API_BASE_URL}/backend-certificado/request-certificate`;
const PAGE_LIMIT = 200;

async function fetchPage(page) {
  const url = `${API_URL}?limit=${PAGE_LIMIT}&page=${page}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${body ? ": " + body.slice(0, 150) : ""}`);
  }

  const json = await res.json();
  return json?.data;
}

async function seedCertificateRequests(prisma) {
  const existingCount = await prisma.certificateRequest.count();
  if (existingCount > 0 && !process.env.FORCE_SEEDS) {
    console.log(`  ℹ ${existingCount} solicitudes ya existen, saltando`);
    return;
  }

  console.log("  ℹ Cargando primera página para determinar total...");

  let firstPage;
  try {
    firstPage = await fetchPage(1);
  } catch (err) {
    console.warn(`  ⚠ Could not fetch certificate requests: ${err.message}`);
    return;
  }

  if (!firstPage?.docs?.length) {
    console.log("  ℹ No certificate requests to import");
    return;
  }

  const totalPages = firstPage.totalPages || 1;
  console.log(`  ℹ ${firstPage.totalDocs} solicitudes en ${totalPages} páginas`);

  const [userByDni, clientByDoc] = await Promise.all([
    prisma.user.findMany({ select: { id: true, dni: true } }).then((users) => {
      const map = new Map();
      for (const u of users) {
        if (u.dni) map.set(u.dni, u.id);
      }
      return map;
    }),
    prisma.client.findMany({ select: { id: true, documentNumber: true } }).then((clients) => {
      const map = new Map();
      for (const c of clients) map.set(c.documentNumber, c.id);
      return map;
    }),
  ]);

  const allDocs = [...firstPage.docs];

  for (let page = 2; page <= totalPages; page++) {
    try {
      const data = await fetchPage(page);
      if (data?.docs) allDocs.push(...data.docs);
      process.stdout.write(`    Página ${page}/${totalPages}\r`);
    } catch (err) {
      console.warn(`\n  ⚠ Error en página ${page}: ${err.message}`);
    }
  }
  console.log(`\n  ℹ Total ${allDocs.length} solicitudes descargadas`);

  // Crear placeholders para clientes faltantes
  const missingDocs = new Set();
  for (const doc of allDocs) {
    if (doc.documentClient && !clientByDoc.get(doc.documentClient)) {
      missingDocs.add(doc.documentClient);
    }
  }
  if (missingDocs.size > 0) {
    console.log(`  ℹ ${missingDocs.size} clientes faltantes, creando placeholders...`);
    for (const doc of allDocs) {
      if (!missingDocs.has(doc.documentClient)) continue;
      missingDocs.delete(doc.documentClient);
      const createdAt = new Date(doc.createdAt);
      const placeholder = await prisma.client.create({
        data: {
          documentNumber: doc.documentClient,
          fullName: doc.fullNameClient?.trim() || "-",
          clientType: doc.isComunero === true ? "Comunero" : "Tercero",
          createdAt,
          updatedAt: createdAt,
        },
      });
      clientByDoc.set(doc.documentClient, placeholder.id);
      console.log(`    Placeholder: ${doc.documentClient} (${doc.fullNameClient})`);
    }
  }

  const existingNumbers = new Set(
    (await prisma.certificateRequest.findMany({ select: { requestNumber: true } })).map((r) => r.requestNumber)
  );

  let imported = 0;
  let skipped = 0;

  for (const doc of allDocs) {
    const requestNumber = doc.countRequestCertificate?.trim();
    if (!requestNumber || existingNumbers.has(requestNumber)) {
      skipped++;
      continue;
    }

    const clientId = clientByDoc.get(doc.documentClient);
    if (!clientId) {
      skipped++;
      continue;
    }

    const partnerId = doc.documentPartnerClient?.trim()
      ? clientByDoc.get(doc.documentPartnerClient.trim()) || null
      : null;

    const userId = doc.createdByDni ? userByDni.get(doc.createdByDni) || null : null;

    try {
      await prisma.certificateRequest.create({
        data: {
          requestNumber,
          clientId,
          userId,
          partnerId,
          description: doc.description?.trim() || null,
          destination: doc.destination?.trim() || null,
          exposure: doc.exposure?.trim() || null,
          sectorLocation: doc.sectorLocation?.trim() || null,
          certificateTypes: Array.isArray(doc.type) ? doc.type.map((t) => ({ type: t })) : null,
          attachments: Array.isArray(doc.attachment) ? doc.attachment.map((a) => ({ type: a })) : null,
          createdAt: new Date(doc.createdAt),
          updatedAt: new Date(doc.updatedAt),
        },
      });
      imported++;
    } catch (err) {
      console.warn(`  ⚠ Error importing request "${requestNumber}": ${err.message}`);
    }
  }

  console.log(`  ✓ ${imported} solicitudes importadas, ${skipped} omitidas`);
}

module.exports = { seedCertificateRequests };
