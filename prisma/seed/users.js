const bcrypt = require("bcryptjs");

const DEFAULT_PASSWORD = process.env.SEED_IMPORTED_USER_PASSWORD || "123456";

const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const normalizeDni = (value) => String(value || "").trim();

async function seedUsers(prisma, api) {
  let remoteUsers;

  try {
    remoteUsers = await api.listAll("/api/users", { limit: 100 });
  } catch (err) {
    console.warn(`  ⚠ Could not fetch users: ${err.message}`);
    return;
  }

  if (!Array.isArray(remoteUsers) || remoteUsers.length === 0) {
    console.log("  ℹ No users to import");
    return;
  }

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const remoteUser of remoteUsers) {
    if (!remoteUser?.username) {
      continue;
    }

    const roleName = remoteUser.role?.name || remoteUser.roleName || "AtencionCliente";
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      console.warn(`  ⚠ Rol "${roleName}" no encontrado para usuario "${remoteUser.username}", saltando`);
      continue;
    }

    await prisma.user.upsert({
      where: { username: remoteUser.username },
      create: {
        username: remoteUser.username,
        password: hash,
        fullName: String(remoteUser.fullName || "-").trim() || "-",
        email: remoteUser.email && String(remoteUser.email).includes("@") ? String(remoteUser.email).trim() : `${remoteUser.username}@importado.local`,
        dni: remoteUser.dni ? normalizeDni(remoteUser.dni) : null,
        isActive: remoteUser.isActive !== undefined ? Boolean(remoteUser.isActive) : true,
        certificateRangeStart: remoteUser.certificateRangeStart ?? null,
        certificateRangeEnd: remoteUser.certificateRangeEnd ?? null,
        lastCertificate: remoteUser.lastCertificate ? Number.parseInt(String(remoteUser.lastCertificate).trim(), 10) || null : null,
        roleId: role.id,
        createdAt: parseDate(remoteUser.createdAt),
        updatedAt: parseDate(remoteUser.updatedAt),
      },
      update: {
        fullName: String(remoteUser.fullName || "-").trim() || "-",
        email: remoteUser.email && String(remoteUser.email).includes("@") ? String(remoteUser.email).trim() : `${remoteUser.username}@importado.local`,
        dni: remoteUser.dni ? normalizeDni(remoteUser.dni) : null,
        isActive: remoteUser.isActive !== undefined ? Boolean(remoteUser.isActive) : true,
        certificateRangeStart: remoteUser.certificateRangeStart ?? null,
        certificateRangeEnd: remoteUser.certificateRangeEnd ?? null,
        lastCertificate: remoteUser.lastCertificate ? Number.parseInt(String(remoteUser.lastCertificate).trim(), 10) || null : null,
        roleId: role.id,
        updatedAt: parseDate(remoteUser.updatedAt),
      },
    });

    console.log(`  ✓ Usuario "${remoteUser.username}"`);
  }
}

module.exports = { seedUsers };
