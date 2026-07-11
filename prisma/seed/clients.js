const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const normalizeText = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value).trim() || null;
};

const parseLicenseSequence = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(numeric) ? numeric : null;
};

const getNextLicenseSequence = async (tx) => {
  const lastProfile = await tx.commoner.findFirst({
    where: { licenseSequence: { not: null } },
    orderBy: { licenseSequence: "desc" },
    select: { licenseSequence: true },
  });

  return (lastProfile?.licenseSequence ?? 0) + 1;
};

async function seedClients(prisma, api) {
  try {
    const clients = await api.listAll("/api/clients", { limit: 100 });

    if (!Array.isArray(clients) || clients.length === 0) {
      console.log("  ℹ No hay clientes para importar");
      return;
    }

    const remoteClients = clients
      .map((client) => ({
        id: Number(client?.id),
        fullName: normalizeText(client?.fullName) || "-",
        documentNumber: normalizeText(client?.documentNumber),
        address: normalizeText(client?.address),
        phone: normalizeText(client?.phone),
        clientType: client?.clientType,
        licenseSequence: parseLicenseSequence(client?.licenseSequence ?? client?.nro_licence),
        createdAt: parseDate(client?.createdAt),
        updatedAt: parseDate(client?.updatedAt),
      }))
      .filter((client) => client.id && client.documentNumber);

    const existingClients = await prisma.client.findMany({
      select: {
        id: true,
        documentNumber: true,
        _count: {
          select: {
            certificates: true,
            partnerCertificates: true,
            certificateRequests: true,
            partnerRequests: true,
            assemblyRecordRequests: true,
            certificateOwners: true,
          },
        },
      },
    });

    const existingById = new Map(existingClients.map((client) => [client.id, client]));
    const existingByDocument = new Map(existingClients.map((client) => [client.documentNumber, client]));
    const remoteIds = new Set();

    let imported = 0;
    let updated = 0;
    let deleted = 0;
    let skipped = 0;

    for (const remoteClient of remoteClients) {
      remoteIds.add(remoteClient.id);

      const byId = existingById.get(remoteClient.id) || null;
      const byDocument = !byId ? existingByDocument.get(remoteClient.documentNumber) || null : null;

      if (byDocument && byDocument.id !== remoteClient.id) {
        const dependencyCount =
          byDocument._count.certificates +
          byDocument._count.partnerCertificates +
          byDocument._count.certificateRequests +
          byDocument._count.partnerRequests +
          byDocument._count.assemblyRecordRequests +
          byDocument._count.certificateOwners;

        if (dependencyCount > 0) {
          console.warn(`  ⚠ No se pudo recrear el cliente #${remoteClient.id} "${remoteClient.documentNumber}" porque el registro local equivalente tiene ${dependencyCount} dependencias`);
          skipped++;
          continue;
        }

        await prisma.client.delete({ where: { id: byDocument.id } });
        existingById.delete(byDocument.id);
        existingByDocument.delete(byDocument.documentNumber);
      }

      try {
        await prisma.$transaction(async (tx) => {
          const client = await tx.client.upsert({
            where: { id: remoteClient.id },
            create: {
              id: remoteClient.id,
              fullName: remoteClient.fullName,
              documentNumber: remoteClient.documentNumber,
              address: remoteClient.address,
              phone: remoteClient.phone,
              createdAt: remoteClient.createdAt,
              updatedAt: remoteClient.updatedAt,
            },
            update: {
              fullName: remoteClient.fullName,
              documentNumber: remoteClient.documentNumber,
              address: remoteClient.address,
              phone: remoteClient.phone,
              createdAt: remoteClient.createdAt,
              updatedAt: remoteClient.updatedAt,
            },
          });

          if (remoteClient.clientType === "Comunero") {
            const existingCommoner = await tx.commoner.findUnique({ where: { clientId: client.id } });
            const licenseSequence = remoteClient.licenseSequence ?? existingCommoner?.licenseSequence ?? await getNextLicenseSequence(tx);

            if (existingCommoner) {
              await tx.commoner.update({
                where: { clientId: client.id },
                data: {
                  licenseSequence,
                  isActive: true,
                  createdAt: remoteClient.createdAt,
                  updatedAt: remoteClient.updatedAt,
                },
              });
            } else {
              await tx.commoner.create({
                data: {
                  clientId: client.id,
                  licenseSequence,
                  isActive: true,
                  createdAt: remoteClient.createdAt,
                  updatedAt: remoteClient.updatedAt,
                },
              });
            }
          } else {
            const existingCommoner = await tx.commoner.findUnique({ where: { clientId: client.id } });
            if (existingCommoner) {
              await tx.commoner.update({
                where: { clientId: client.id },
                data: {
                  isActive: false,
                  updatedAt: remoteClient.updatedAt,
                },
              });
            }
          }
        });

        if (byId || byDocument) {
          updated++;
        } else {
          imported++;
        }

        console.log(`  ✓ Cliente #${remoteClient.id} "${remoteClient.documentNumber}"`);
      } catch (err) {
        skipped++;
        console.warn(`  ⚠ No se pudo importar el cliente #${remoteClient.id} "${remoteClient.documentNumber}": ${err.message}`);
      }
    }

    for (const existingClient of existingClients) {
      if (remoteIds.has(existingClient.id)) {
        continue;
      }

      const dependencyCount =
        existingClient._count.certificates +
        existingClient._count.partnerCertificates +
        existingClient._count.certificateRequests +
        existingClient._count.partnerRequests +
        existingClient._count.assemblyRecordRequests +
        existingClient._count.certificateOwners;

      if (dependencyCount > 0) {
        console.warn(`  ⚠ No se eliminó el cliente #${existingClient.id} "${existingClient.documentNumber}" porque tiene ${dependencyCount} registros asociados`);
        skipped++;
        continue;
      }

      await prisma.client.delete({ where: { id: existingClient.id } });
      deleted++;
      console.log(`  ✓ Cliente eliminado #${existingClient.id} "${existingClient.documentNumber}"`);
    }

    const comuneros = remoteClients.filter((client) => client.clientType === "Comunero").length;
    console.log(`  ✓ ${imported} clientes importados, ${updated} actualizados, ${deleted} eliminados, ${skipped} omitidos`);
    console.log(`    ${comuneros} comuneros, ${remoteClients.length - comuneros} terceros`);
  } catch (err) {
    console.warn(`  ⚠ No se pudieron obtener los clientes: ${err.message}`);
  }
}

module.exports = { seedClients };
