const normalizeAddress = (value) => {
  const text = String(value || "").trim();
  return text || null;
};

async function seedCertificateRequestAddresses(prisma) {
  const requests = await prisma.certificateRequest.findMany({
    select: {
      legacyPayload: true,
      client: {
        select: {
          id: true,
          documentNumber: true,
          address: true,
        },
      },
      partner: {
        select: {
          id: true,
          documentNumber: true,
          address: true,
        },
      },
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!requests.length) {
    console.log("  ℹ No hay solicitudes para sincronizar direcciones");
    return;
  }

  const clientAddressByDoc = new Map();
  const partnerAddressByDoc = new Map();

  for (const request of requests) {
    const legacy = request.legacyPayload && typeof request.legacyPayload === "object" ? request.legacyPayload : null;
    if (!legacy) {
      continue;
    }

    const clientDoc = request.client?.documentNumber;
    const clientAddress = normalizeAddress(legacy.directionClient);
    if (clientDoc && clientAddress) {
      clientAddressByDoc.set(clientDoc, clientAddress);
    }

    const partnerDoc = request.partner?.documentNumber;
    if (partnerDoc && !partnerAddressByDoc.has(partnerDoc)) {
      partnerAddressByDoc.set(partnerDoc, null);
    }

    const partnerAddress = normalizeAddress(legacy.directionPartnerClient);
    if (partnerDoc && partnerAddress) {
      partnerAddressByDoc.set(partnerDoc, partnerAddress);
    }
  }

  const allDocs = new Set([...clientAddressByDoc.keys(), ...partnerAddressByDoc.keys()]);
  if (!allDocs.size) {
    console.log("  ℹ No hay direcciones legadas para sincronizar");
    return;
  }

  const clients = await prisma.client.findMany({
    where: { documentNumber: { in: [...allDocs] } },
    select: {
      id: true,
      documentNumber: true,
      address: true,
    },
  });

  let updatedClients = 0;

  for (const client of clients) {
    const targetAddress = clientAddressByDoc.has(client.documentNumber)
      ? clientAddressByDoc.get(client.documentNumber)
      : partnerAddressByDoc.get(client.documentNumber);

    if (targetAddress === undefined) {
      continue;
    }

    if ((client.address ?? null) === targetAddress) {
      continue;
    }

    await prisma.client.update({
      where: { id: client.id },
      data: { address: targetAddress },
    });
    updatedClients += 1;
  }

  console.log(`  ✓ ${updatedClients} clientes actualizados desde solicitudes`);
}

module.exports = { seedCertificateRequestAddresses };
