const bcrypt = require("bcryptjs");

const ADMIN_USER = {
  username: "pierols",
  password: "123456",
  fullName: "Piero Llanos Sánchez",
  email: "piero@gmail.com",
  dni: "73171545",
  roleName: "Admin",
};

async function seedUsers(prisma) {
  const role = await prisma.role.findUnique({ where: { name: ADMIN_USER.roleName } });
  if (!role) throw new Error(`Rol "${ADMIN_USER.roleName}" no encontrado`);

  const hash = await bcrypt.hash(ADMIN_USER.password, 10);

  await prisma.user.upsert({
    where: { username: ADMIN_USER.username },
    create: {
      username: ADMIN_USER.username,
      password: hash,
      fullName: ADMIN_USER.fullName,
      email: ADMIN_USER.email,
      dni: ADMIN_USER.dni,
      roleId: role.id,
    },
    update: {},
  });

  console.log(`  ✓ Usuario "${ADMIN_USER.username}"`);
}

module.exports = { seedUsers };
