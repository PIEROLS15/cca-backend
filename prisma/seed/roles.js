const syncPermissions = async (tx, roleId, permissions = []) => {
  await tx.rolePermission.deleteMany({ where: { roleId } });

  for (const item of permissions) {
    const key = typeof item === "string" ? item : item?.key;
    if (!key) {
      continue;
    }

    const permission = await tx.permission.upsert({
      where: { key },
      create: {
        key,
        description: typeof item === "object" && item ? item.description || null : null,
      },
      update: {
        description: typeof item === "object" && item ? item.description || undefined : undefined,
      },
    });

    await tx.rolePermission.create({
      data: {
        roleId,
        permissionId: permission.id,
      },
    });
  }
};

const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

async function seedRoles(prisma, api) {
  let remoteRoles;

  try {
    remoteRoles = await api.listAll("/api/roles", { limit: 100 });
  } catch (err) {
    console.warn(`  ⚠ No se pudieron obtener los roles: ${err.message}`);
    return;
  }

  if (!Array.isArray(remoteRoles) || remoteRoles.length === 0) {
    console.log("  ℹ No hay roles para importar");
    return;
  }

  const remoteRoleIds = new Set();

  for (const role of remoteRoles) {
    const id = Number(role?.id);
    if (!id || !role?.name) {
      continue;
    }

    remoteRoleIds.add(id);

    await prisma.$transaction(async (tx) => {
      const existingById = await tx.role.findUnique({ where: { id } });

      if (!existingById) {
        const existingByName = await tx.role.findUnique({ where: { name: role.name } });
        if (existingByName && existingByName.id !== id) {
          const dependencyCount = await tx.user.count({ where: { roleId: existingByName.id } });
          if (dependencyCount > 0) {
            throw new Error(`No se puede reemplazar el rol "${role.name}" con id ${existingByName.id} porque tiene ${dependencyCount} usuarios asociados`);
          }

          await tx.rolePermission.deleteMany({ where: { roleId: existingByName.id } });
          await tx.role.delete({ where: { id: existingByName.id } });
        }
      }

      const existing = await tx.role.upsert({
        where: { id },
        create: {
          id,
          name: role.name,
          description: role.description || null,
          createdAt: parseDate(role.createdAt),
          updatedAt: parseDate(role.updatedAt),
        },
        update: {
          name: role.name,
          description: role.description || null,
          createdAt: parseDate(role.createdAt),
          updatedAt: parseDate(role.updatedAt),
        },
      });

      await syncPermissions(tx, existing.id, Array.isArray(role.permissions) ? role.permissions : []);
    });

    console.log(`  ✓ Rol #${id} "${role.name}"`);
  }

  const existingRoles = await prisma.role.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: { users: true },
      },
    },
  });

  for (const role of existingRoles) {
    if (remoteRoleIds.has(role.id)) {
      continue;
    }

    if (role._count.users > 0) {
      throw new Error(`No se puede eliminar el rol local "${role.name}" (#${role.id}) porque tiene ${role._count.users} usuarios asociados y ya no viene de /api/roles`);
    }

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.role.delete({ where: { id: role.id } });
    console.log(`  ✓ Rol eliminado #${role.id} "${role.name}"`);
  }
}

async function syncRoleSequence(prisma) {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('"Role"', 'id'),
      COALESCE((SELECT MAX(id) FROM "Role"), 1),
      (SELECT COUNT(*) > 0 FROM "Role")
    )
  `);
}

module.exports = { seedRoles, syncRoleSequence };
