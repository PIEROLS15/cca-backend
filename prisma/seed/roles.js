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

async function seedRoles(prisma, api) {
  let remoteRoles;

  try {
    remoteRoles = await api.listAll("/api/roles", { limit: 100 });
  } catch (err) {
    console.warn(`  ⚠ Could not fetch roles: ${err.message}`);
    return;
  }

  if (!Array.isArray(remoteRoles) || remoteRoles.length === 0) {
    console.log("  ℹ No roles to import");
    return;
  }

  for (const role of remoteRoles) {
    if (!role?.name) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.role.upsert({
        where: { name: role.name },
        create: {
          name: role.name,
          description: role.description || null,
        },
        update: {
          description: role.description || null,
        },
      });

      await syncPermissions(tx, existing.id, Array.isArray(role.permissions) ? role.permissions : []);
    });

    console.log(`  ✓ Rol "${role.name}"`);
  }
}

module.exports = { seedRoles };
