const prisma = require("../config/prisma");
const HttpError = require("./http-error");

const DEFAULT_ROLES = [
  { name: "Admin", description: "Acceso total al sistema" },
  { name: "Presidente", description: "Aprobaciones y supervisiones" },
  { name: "AtencionCliente", description: "Atencion operativa de solicitudes" },
];

const withRoleInclude = {
  rolePermissions: {
    include: {
      permission: true,
    },
  },
};

const normalizeRoleName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[_\s-]/g, "");

const ensureBaseRoles = async () => {
  await Promise.all(
    DEFAULT_ROLES.map((role) =>
      prisma.role.upsert({
        where: { name: role.name },
        create: role,
        update: {
          description: role.description,
        },
      })
    )
  );
};

const getRoleByName = async (name) => {
  const roles = await prisma.role.findMany({ include: withRoleInclude });
  const normalizedTarget = normalizeRoleName(name);

  return roles.find((role) => normalizeRoleName(role.name) === normalizedTarget) || null;
};

const resolveRoleForUser = async ({ roleId, roleName }) => {
  await ensureBaseRoles();

  if (roleId) {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: withRoleInclude,
    });

    if (!role) {
      throw new HttpError(404, "Rol no encontrado");
    }

    return role;
  }

  if (roleName) {
    const role = await getRoleByName(roleName);
    if (!role) {
      throw new HttpError(404, "Rol no encontrado");
    }
    return role;
  }

  const defaultRole = await getRoleByName("AtencionCliente");
  if (!defaultRole) {
    throw new HttpError(500, "No se pudo resolver el rol por defecto");
  }

  return defaultRole;
};

module.exports = {
  ensureBaseRoles,
  resolveRoleForUser,
  withRoleInclude,
};
