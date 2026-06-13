const BEARER_TOKEN = process.env.BEARER_TOKEN;

const CLIENTS_URL = `${process.env.API_BASE_URL}/backend-certificado/client/combo`;
const COMMONERS_URL = `${process.env.API_BASE_URL}/backend-certificado/commoner/all`;

async function fetchJson(url) {
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

async function seedClients(prisma) {
  const existingCount = await prisma.client.count();
  if (existingCount > 0 && !process.env.FORCE_SEEDS) {
    console.log(`  ℹ ${existingCount} clientes ya existen, saltando`);
    return;
  }

  let clients, commoners;

  try {
    [clients, commoners] = await Promise.all([
      fetchJson(CLIENTS_URL),
      fetchJson(COMMONERS_URL),
    ]);
  } catch (err) {
    console.warn(`  ⚠ Could not fetch data: ${err.message}`);
    return;
  }

  if (!Array.isArray(clients) && !Array.isArray(commoners)) {
    console.log("  ℹ No clients or commoners to import");
    return;
  }

  const clientMap = new Map();
  for (const c of clients || []) {
    if (c.document) clientMap.set(c.document, c);
  }

  const commonerMap = new Map();
  for (const c of commoners || []) {
    if (c.document) {
      if (commonerMap.has(c.document)) {
        console.warn(`  ⚠ Documento duplicado en comuneros: ${c.document}`);
      }
      commonerMap.set(c.document, c);
    }
  }

  const allDocs = new Set([...clientMap.keys(), ...commonerMap.keys()]);
  const clientRecords = [];
  const comuneroData = [];

  for (const doc of allDocs) {
    const client = clientMap.get(doc);
    const commoner = commonerMap.get(doc);

    if (commoner) {
      const fullName = [commoner.fullname, commoner.lastname, commoner.second_lastname]
        .filter((p) => p && p.trim() && p !== "-")
        .join(" ")
        .trim() || client?.fullname?.trim() || "-";

      const licenseSeq = parseInt(commoner.nro_licence, 10);

      clientRecords.push({
        fullName,
        documentNumber: doc,
        address: client?.direction?.trim() || null,
        phone: client?.mobilephone?.trim() || null,
        createdAt: client
          ? new Date(Math.max(+new Date(commoner.createdAt), +new Date(client.createdAt)))
          : new Date(commoner.createdAt),
        updatedAt: client
          ? new Date(Math.max(+new Date(commoner.updatedAt), +new Date(client.updatedAt)))
          : new Date(commoner.updatedAt),
      });

      comuneroData.push({
        documentNumber: doc,
        licenseSequence: isNaN(licenseSeq) ? null : licenseSeq,
        createdAt: new Date(commoner.createdAt),
        updatedAt: new Date(commoner.updatedAt),
      });
    } else {
      clientRecords.push({
        fullName: client.fullname?.trim() || "-",
        documentNumber: doc,
        address: client.direction?.trim() || null,
        phone: client.mobilephone?.trim() || null,
        createdAt: new Date(client.createdAt),
        updatedAt: new Date(client.updatedAt),
      });
    }
  }

  const existingDocs = await prisma.client.findMany({
    select: { documentNumber: true },
  });
  const existingSet = new Set(existingDocs.map((c) => c.documentNumber));

  const newClientRecords = clientRecords.filter((r) => !existingSet.has(r.documentNumber));

  if (newClientRecords.length === 0) {
    console.log(`  ✓ 0 clientes nuevos (${clientRecords.length} ya existentes)`);
    const comuneroCount = [...allDocs].filter((d) => commonerMap.has(d)).length;
    console.log(`    ${comuneroCount} comuneros, ${clientRecords.length - comuneroCount} terceros`);
    return;
  }

  let imported = 0;
  for (let i = 0; i < newClientRecords.length; i += 100) {
    const batch = newClientRecords.slice(i, i + 100);
    await prisma.client.createMany({ data: batch, skipDuplicates: true });
    imported += batch.length;
  }

  const createdClients = await prisma.client.findMany({
    where: { documentNumber: { in: newClientRecords.map((r) => r.documentNumber) } },
    select: { id: true, documentNumber: true },
  });
  const clientIdByDoc = new Map(createdClients.map((c) => [c.documentNumber, c.id]));

  const profileRecords = comuneroData
    .filter((c) => clientIdByDoc.has(c.documentNumber))
    .map((c) => ({
      clientId: clientIdByDoc.get(c.documentNumber),
      licenseSequence: c.licenseSequence,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

  if (profileRecords.length > 0) {
    for (let i = 0; i < profileRecords.length; i += 100) {
      const batch = profileRecords.slice(i, i + 100);
      await prisma.commoner.createMany({ data: batch, skipDuplicates: true });
    }
  }

  const comuneroCount = [...allDocs].filter((d) => commonerMap.has(d)).length;
  console.log(`  ✓ ${imported} clientes importados${imported < clientRecords.length ? ` (${clientRecords.length - imported} ya existentes)` : ""}`);
  console.log(`    ${comuneroCount} comuneros, ${clientRecords.length - comuneroCount} terceros`);
}

module.exports = { seedClients };
