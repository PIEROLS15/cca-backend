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
  const records = [];

  for (const doc of allDocs) {
    const client = clientMap.get(doc);
    const commoner = commonerMap.get(doc);

    if (commoner) {
      const fullName = [commoner.fullname, commoner.lastname, commoner.second_lastname]
        .filter((p) => p && p.trim() && p !== "-")
        .join(" ")
        .trim() || client?.fullname?.trim() || "-";

      const licenseSeq = parseInt(commoner.nro_licence, 10);

      records.push({
        fullName,
        documentNumber: doc,
        address: client?.direction?.trim() || null,
        phone: client?.mobilephone?.trim() || null,
        clientType: "Comunero",
        licenseSequence: isNaN(licenseSeq) ? null : licenseSeq,
        createdAt: client
          ? new Date(Math.max(+new Date(commoner.createdAt), +new Date(client.createdAt)))
          : new Date(commoner.createdAt),
        updatedAt: client
          ? new Date(Math.max(+new Date(commoner.updatedAt), +new Date(client.updatedAt)))
          : new Date(commoner.updatedAt),
      });
    } else {
      records.push({
        fullName: client.fullname?.trim() || "-",
        documentNumber: doc,
        address: client.direction?.trim() || null,
        phone: client.mobilephone?.trim() || null,
        clientType: "Tercero",
        licenseSequence: null,
        createdAt: new Date(client.createdAt),
        updatedAt: new Date(client.updatedAt),
      });
    }
  }

  const existingDocs = await prisma.client.findMany({
    select: { documentNumber: true },
  });
  const existingSet = new Set(existingDocs.map((c) => c.documentNumber));

  const newRecords = records.filter((r) => !existingSet.has(r.documentNumber));

  if (newRecords.length === 0) {
    console.log(`  ✓ 0 clientes nuevos (${records.length} ya existentes)`);
    const comuneroCount = [...allDocs].filter((d) => commonerMap.has(d)).length;
    console.log(`    ${comuneroCount} comuneros, ${records.length - comuneroCount} terceros`);
    return;
  }

  let imported = 0;
  for (let i = 0; i < newRecords.length; i += 100) {
    const batch = newRecords.slice(i, i + 100);
    await prisma.client.createMany({ data: batch, skipDuplicates: true });
    imported += batch.length;
  }

  const comuneroCount = records.filter((r) => r.clientType === "Comunero").length;
  console.log(`  ✓ ${imported} clientes importados${imported < records.length ? ` (${records.length - imported} ya existentes)` : ""}`);
  console.log(`    ${comuneroCount} comuneros, ${records.length - comuneroCount} terceros`);
}

module.exports = { seedClients };
