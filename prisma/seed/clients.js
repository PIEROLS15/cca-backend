const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const parseLicenseSequence = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(numeric) ? numeric : null;
};

async function seedClients(prisma, api) {
  const existingCount = await prisma.client.count();
  if (existingCount > 0 && !process.env.FORCE_SEEDS) {
    console.log(`  ℹ ${existingCount} clientes ya existen, saltando`);
    return;
  }

  try {
    const clients = await api.listAll("/api/clients", { limit: 100 });

    if (!Array.isArray(clients) || clients.length === 0) {
      console.log("  ℹ No clients to import");
      return;
    }

    const clientRecords = clients.map((client) => ({
      fullName: String(client.fullName || "-").trim() || "-",
      documentNumber: String(client.documentNumber || "").trim(),
      address: client.address ? String(client.address).trim() : null,
      phone: client.phone ? String(client.phone).trim() : null,
      createdAt: parseDate(client.createdAt),
      updatedAt: parseDate(client.updatedAt),
    })).filter((client) => client.documentNumber);

    const comuneroRecords = clients
      .filter((client) => client.clientType === "Comunero")
      .map((client) => ({
        documentNumber: String(client.documentNumber || "").trim(),
        licenseSequence: parseLicenseSequence(client.licenseSequence ?? client.nro_licence),
        createdAt: parseDate(client.createdAt),
        updatedAt: parseDate(client.updatedAt),
      }))
      .filter((client) => client.documentNumber);

    const existingDocs = await prisma.client.findMany({
      select: { documentNumber: true },
    });
    const existingSet = new Set(existingDocs.map((client) => client.documentNumber));

    const newClientRecords = clientRecords.filter((client) => !existingSet.has(client.documentNumber));

    if (newClientRecords.length === 0) {
      console.log(`  ✓ 0 clientes nuevos (${clientRecords.length} ya existentes)`);
      const comuneroCount = comuneroRecords.length;
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
      where: { documentNumber: { in: newClientRecords.map((client) => client.documentNumber) } },
      select: { id: true, documentNumber: true },
    });
    const clientIdByDoc = new Map(createdClients.map((client) => [client.documentNumber, client.id]));

    const profileRecords = comuneroRecords
      .filter((client) => clientIdByDoc.has(client.documentNumber))
      .map((client) => ({
        clientId: clientIdByDoc.get(client.documentNumber),
        licenseSequence: client.licenseSequence,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      }));

    if (profileRecords.length > 0) {
      for (let i = 0; i < profileRecords.length; i += 100) {
        const batch = profileRecords.slice(i, i + 100);
        await prisma.commoner.createMany({ data: batch, skipDuplicates: true });
      }
    }

    const comuneroCount = comuneroRecords.length;
    console.log(`  ✓ ${imported} clientes importados${imported < clientRecords.length ? ` (${clientRecords.length - imported} ya existentes)` : ""}`);
    console.log(`    ${comuneroCount} comuneros, ${clientRecords.length - comuneroCount} terceros`);
  } catch (err) {
    console.warn(`  ⚠ Could not fetch clients: ${err.message}`);
  }
}

module.exports = { seedClients };
