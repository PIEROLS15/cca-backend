const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const { ensureBaseRoles } = require("../../../utils/role.utils");
const { sanitizeRole } = require("../utils/roles.utils");

const roleInclude = {
  rolePermissions: {
    include: {
      permission: true,
    },
  },
};

const syncPermissions = async (tx, roleId, permissions = []) => {
  await tx.rolePermission.deleteMany({ where: { roleId } });

  if (!permissions.length) {
    return;
  }

  for (const item of permissions) {
    const key = item.key || item;
    if (!key) {
      // eslint-disable-next-line no-continue
      continue;
    }

    const permission = await tx.permission.upsert({
      where: { key },
      create: {
        key,
        description: item.description || null,
      },
      update: {
        description: item.description || undefined,
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

const listRoles = async (query) => {
  await ensureBaseRoles();
  const { page, limit, skip } = getPaginationParams(query);

  const [docs, total] = await Promise.all([
    prisma.role.findMany({
      include: roleInclude,
      orderBy: { id: "desc" },
      skip,
      take: limit,
    }),
    prisma.role.count(),
  ]);

  return buildPaginationResult({
    docs: docs.map(sanitizeRole),
    total,
    page,
    limit,
  });
};

const getRoleById = async (id) => {
  const role = await prisma.role.findUnique({
    where: { id },
    include: roleInclude,
  });

  if (!role) {
    throw new HttpError(404, "Rol no encontrado");
  }

  return sanitizeRole(role);
};

const createRole = async ({ name, description, permissions }) => {
  const existingRole = await prisma.role.findUnique({ where: { name } });
  if (existingRole) {
    throw new HttpError(409, "El rol ya existe");
  }

  const role = await prisma.$transaction(async (tx) => {
    const createdRole = await tx.role.create({
      data: {
        name,
        description: description || null,
      },
    });

    await syncPermissions(tx, createdRole.id, permissions || []);

    return tx.role.findUnique({
      where: { id: createdRole.id },
      include: roleInclude,
    });
  });

  return sanitizeRole(role);
};

const updateRole = async (id, payload) => {
  const existingRole = await prisma.role.findUnique({ where: { id } });
  if (!existingRole) {
    throw new HttpError(404, "Rol no encontrado");
  }

  const role = await prisma.$transaction(async (tx) => {
    if (payload.name && payload.name !== existingRole.name) {
      const duplicate = await tx.role.findUnique({ where: { name: payload.name } });
      if (duplicate) {
        throw new HttpError(409, "El rol ya existe");
      }
    }

    await tx.role.update({
      where: { id },
      data: {
        name: payload.name,
        description: payload.description,
      },
    });

    if (payload.permissions) {
      await syncPermissions(tx, id, payload.permissions);
    }

    return tx.role.findUnique({
      where: { id },
      include: roleInclude,
    });
  });

  return sanitizeRole(role);
};

const deleteRole = async (id) => {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) {
    throw new HttpError(404, "Rol no encontrado");
  }

  const usersCount = await prisma.user.count({ where: { roleId: id } });
  if (usersCount > 0) {
    throw new HttpError(409, "No se puede eliminar el rol porque tiene usuarios asociados");
  }

  await prisma.role.delete({ where: { id } });
};

module.exports = {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
};
