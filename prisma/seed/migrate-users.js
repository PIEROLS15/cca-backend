const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const DATA_FILE = path.join(__dirname, "users-data.json");
const DEFAULT_PASSWORD = "COMUNA2026";

const ROLE_MAP = {
  admin: "Admin",
  secretaria: "Secretaria",
  presidente: "Presidente",
  asistente: "Asistente",
  supervisor: "Supervisor",
  superadmin: "SuperAdmin",
  atencion: "AtencionCliente",
  ingeniero: "Ingeniero",
};

function mapUser(raw) {
  const fullName = [raw.name, raw.lastname, raw.secondlastname]
    .filter((p) => p && p.trim() && p !== "-")
    .join(" ")
    .trim();

  const username = raw.email || raw._id;

  return {
    username,
    fullName: fullName || "-",
    dni: raw.dni || null,
    isActive: raw.enabled ?? true,
    email: raw.email && raw.email.includes("@") ? raw.email : `${username}@importado.local`,
    roleName: ROLE_MAP[raw.rol?.toLowerCase()] || "AtencionCliente",
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

async function migrateUsers(prisma) {
  if (!fs.existsSync(DATA_FILE)) {
    console.log("  ℹ users-data.json not found, skipping migration");
    return;
  }

  const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  const remoteUsers = raw?.data;

  if (!Array.isArray(remoteUsers) || remoteUsers.length === 0) {
    console.log("  ℹ No users to migrate");
    return;
  }

  console.log(`  ℹ Importando ${remoteUsers.length} usuarios desde archivo local`);

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  let imported = 0;
  let skipped = 0;
  for (const rawUser of remoteUsers) {
    const mapped = mapUser(rawUser);

    if (!mapped.username) {
      skipped++;
      continue;
    }

    const role = await prisma.role.findUnique({ where: { name: mapped.roleName } });
    if (!role) {
      console.warn(`  ⚠ Role "${mapped.roleName}" not found for user "${mapped.username}", skipping`);
      skipped++;
      continue;
    }

    try {
      const exists = await prisma.user.findUnique({ where: { username: mapped.username } });
      if (exists) {
        skipped++;
        continue;
      }

      await prisma.user.create({
        data: {
          username: mapped.username,
          password: hash,
          fullName: mapped.fullName,
          email: mapped.email,
          dni: mapped.dni,
          isActive: mapped.isActive,
          roleId: role.id,
          createdAt: mapped.createdAt,
          updatedAt: mapped.updatedAt,
        },
      });
      imported++;
    } catch (err) {
      console.warn(`  ⚠ Error importing user "${mapped.username}": ${err.message}`);
    }
  }

  console.log(`  ✓ ${imported} usuarios migrados, ${skipped} omitidos`);
}

module.exports = { migrateUsers };
