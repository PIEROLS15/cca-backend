const bcrypt = require("bcryptjs");

const DEFAULT_PASSWORD = process.env.SEED_IMPORTED_USER_PASSWORD || "123456";

const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const normalizeDni = (value) => String(value || "").trim();

const parseLastCertificate = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(numeric) ? numeric : null;
};

async function seedUsers(prisma, api) {
  let remoteUsers;

  try {
    remoteUsers = await api.listAll("/api/users", { limit: 100 });
  } catch (err) {
    console.warn(`  ⚠ No se pudieron obtener los usuarios: ${err.message}`);
    return;
  }

  if (!Array.isArray(remoteUsers) || remoteUsers.length === 0) {
    console.log("  ℹ No hay usuarios para importar");
    return;
  }

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const remoteIds = new Set();
  const existingUsers = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      _count: {
        select: {
          certificates: true,
          certificateRequests: true,
          assemblyRecordRequest: true,
        },
      },
    },
  });

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const remoteUser of remoteUsers) {
    const id = Number(remoteUser?.id);
    if (!id || !remoteUser?.username) {
      skipped++;
      continue;
    }

    remoteIds.add(id);

    const roleId = Number(remoteUser.role?.id || remoteUser.roleId);
    const role = roleId ? await prisma.role.findUnique({ where: { id: roleId } }) : null;
    if (!role) {
      const roleLabel = remoteUser.role?.name || remoteUser.roleName || "sin rol";
      console.warn(`  ⚠ Rol "${roleLabel}" no encontrado para el usuario "${remoteUser.username}", saltando`);
      skipped++;
      continue;
    }

    const wasExisting = existingUsers.some((user) => user.id === id);
    const lastCertificate = parseLastCertificate(remoteUser.lastCertificate);
    const normalizedEmail = remoteUser.email ? String(remoteUser.email).trim() : null;
    const normalizedDni = remoteUser.dni ? normalizeDni(remoteUser.dni) : null;

    await prisma.user.upsert({
      where: { id },
      create: {
        id,
        username: remoteUser.username,
        password: hash,
        fullName: String(remoteUser.fullName || "-").trim() || "-",
        email: normalizedEmail,
        dni: normalizedDni,
        isActive: remoteUser.isActive !== undefined ? Boolean(remoteUser.isActive) : true,
        certificateRangeStart: remoteUser.certificateRangeStart ?? null,
        certificateRangeEnd: remoteUser.certificateRangeEnd ?? null,
        lastCertificate,
        roleId: role.id,
        createdAt: parseDate(remoteUser.createdAt),
        updatedAt: parseDate(remoteUser.updatedAt),
      },
      update: {
        username: remoteUser.username,
        fullName: String(remoteUser.fullName || "-").trim() || "-",
        email: normalizedEmail,
        dni: normalizedDni,
        isActive: remoteUser.isActive !== undefined ? Boolean(remoteUser.isActive) : true,
        certificateRangeStart: remoteUser.certificateRangeStart ?? null,
        certificateRangeEnd: remoteUser.certificateRangeEnd ?? null,
        lastCertificate,
        roleId: role.id,
        createdAt: parseDate(remoteUser.createdAt),
        updatedAt: parseDate(remoteUser.updatedAt),
      },
    });

    if (wasExisting) {
      updated++;
    } else {
      imported++;
    }

    console.log(`  ✓ Usuario #${id} "${remoteUser.username}"`);
  }

  const localBootstrapUser = existingUsers.find((user) => user.username === "pierols");
  for (const user of existingUsers) {
    if (remoteIds.has(user.id) || user.username === "pierols") {
      continue;
    }

    const dependencyCount = user._count.certificates + user._count.certificateRequests + user._count.assemblyRecordRequest;
    if (dependencyCount > 0) {
      console.warn(`  ⚠ No se eliminó el usuario #${user.id} "${user.username}" porque tiene ${dependencyCount} registros asociados`);
      continue;
    }

    await prisma.user.delete({ where: { id: user.id } });
    console.log(`  ✓ Usuario eliminado #${user.id} "${user.username}"`);
  }

  if (!localBootstrapUser) {
    console.log("  ℹ No se encontró el usuario local 'pierols' en la base de datos");
  }

  console.log(`  ✓ ${imported} usuarios importados, ${updated} actualizados, ${skipped} omitidos`);
}

async function syncUserSequence(prisma) {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('"User"', 'id'),
      COALESCE((SELECT MAX(id) FROM "User"), 1),
      (SELECT COUNT(*) > 0 FROM "User")
    )
  `);
}

module.exports = { seedUsers, syncUserSequence };
