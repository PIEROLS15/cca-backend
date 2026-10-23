const bcrypt = require("bcryptjs");
const { Prisma } = require("@prisma/client");
const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const { resolveRoleForUser, withRoleInclude } = require("../../../utils/role.utils");
const { canManageUserRole } = require("../../../utils/access-control.utils");
const { sanitizeUser } = require("../utils/users.utils");

const normalizeEmail = (value) => (value ? String(value).trim().toLowerCase() : null);
const normalizeDni = (value) => (value ? String(value).trim() : null);

const MAX_USER_WRITE_RETRIES = 3;

const runUserWriteTransaction = async (handler) => {
  let attempt = 0;

  while (attempt < MAX_USER_WRITE_RETRIES) {
    try {
      return await prisma.$transaction(
        async (tx) => handler(tx),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      attempt += 1;

      if (error?.code !== "P2034" || attempt >= MAX_USER_WRITE_RETRIES) {
        throw error;
      }
    }
  }
};

const assertUniqueUserFields = async ({ email, dni, excludeUserId }, db = prisma) => {
  if (email) {
    const existingByEmail = await db.user.findFirst({
      where: {
        email,
        id: excludeUserId ? { not: excludeUserId } : undefined,
      },
      select: { id: true },
    });

    if (existingByEmail) {
      throw new HttpError(409, "El email ya esta en uso");
    }
  }

  if (dni) {
    const existingByDni = await db.user.findFirst({
      where: {
        dni,
        id: excludeUserId ? { not: excludeUserId } : undefined,
      },
      select: { id: true },
    });

    if (existingByDni) {
      throw new HttpError(409, "El dni ya esta en uso");
    }
  }
};

const listUsers = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const { search } = query;

  const where = {
    roleId: query.roleId || undefined,
    isActive: typeof query.isActive === "boolean" ? query.isActive : undefined,
  };

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { dni: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { username: { contains: search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        role: {
          include: withRoleInclude,
        },
      },
      orderBy: { id: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return buildPaginationResult({
    docs: users.map(sanitizeUser),
    total,
    page,
    limit,
  });
};

const getUserById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      role: {
        include: withRoleInclude,
      },
    },
  });
  if (!user) {
    throw new HttpError(404, "Usuario no encontrado");
  }
  return sanitizeUser(user);
};

const assertActorCanManageUser = (actorRole, targetRole) => {
  if (!canManageUserRole(actorRole, targetRole)) {
    throw new HttpError(403, "No tienes permisos para gestionar usuarios de ese grupo");
  }
};

const createUser = async ({ username, password, fullName, email, dni, roleId }, actorRole) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedDni = normalizeDni(dni);

  return runUserWriteTransaction(async (tx) => {
    const existingUser = await tx.user.findUnique({ where: { username } });
    if (existingUser) {
      throw new HttpError(409, "El nombre de usuario ya existe");
    }

    await assertUniqueUserFields({ email: normalizedEmail, dni: normalizedDni }, tx);

    const hashedPassword = await bcrypt.hash(password, 10);
    const resolvedRole = await resolveRoleForUser({ roleId });
    assertActorCanManageUser(actorRole, resolvedRole.name);

    const user = await tx.user.create({
      data: {
        username,
        password: hashedPassword,
        fullName,
        email: normalizedEmail,
        dni: normalizedDni,
        isActive: true,
        roleId: resolvedRole.id,
      },
      include: {
        role: {
          include: withRoleInclude,
        },
      },
    });

    return sanitizeUser(user);
  });
};

const updateUser = async (id, payload, actorRole) => {
  const normalizedEmail = payload.email !== undefined ? normalizeEmail(payload.email) : undefined;
  const normalizedDni = payload.dni !== undefined ? normalizeDni(payload.dni) : undefined;

  return runUserWriteTransaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { id },
      include: {
        role: {
          include: withRoleInclude,
        },
      },
    });
    if (!existingUser) {
      throw new HttpError(404, "Usuario no encontrado");
    }

    const targetRole = payload.roleId ? await resolveRoleForUser({ roleId: payload.roleId }) : existingUser.role;
    assertActorCanManageUser(actorRole, targetRole.name);

    const data = {
      fullName: payload.fullName,
      roleId: undefined,
    };

    if (payload.roleId) {
      const resolvedRole = await resolveRoleForUser({ roleId: payload.roleId });
      data.roleId = resolvedRole.id;
    }

    if (payload.email !== undefined && normalizedEmail !== existingUser.email) {
      await assertUniqueUserFields({ email: normalizedEmail, excludeUserId: id }, tx);
      data.email = normalizedEmail;
    }

    if (payload.dni !== undefined && normalizedDni !== existingUser.dni) {
      await assertUniqueUserFields({ dni: normalizedDni, excludeUserId: id }, tx);
      data.dni = normalizedDni;
    }

    if (!payload.fullName) {
      delete data.fullName;
    }

    if (payload.password) {
      data.password = await bcrypt.hash(payload.password, 10);
    }

    if (payload.username && payload.username !== existingUser.username) {
      const duplicate = await tx.user.findUnique({ where: { username: payload.username } });
      if (duplicate) {
        throw new HttpError(409, "El nombre de usuario ya existe");
      }
      data.username = payload.username;
    }

    const user = await tx.user.update({
      where: { id },
      data,
      include: {
        role: {
          include: withRoleInclude,
        },
      },
    });

    return sanitizeUser(user);
  });
};

const deleteUser = async (id, actorRole) => {
  const existingUser = await prisma.user.findUnique({
    where: { id },
    include: {
      role: {
        include: withRoleInclude,
      },
    },
  });
  if (!existingUser) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  assertActorCanManageUser(actorRole, existingUser.role.name);
  await prisma.user.delete({ where: { id } });
};

const updateUserStatus = async (id, isActive, actorRole) => {
  const existingUser = await prisma.user.findUnique({
    where: { id },
    include: {
      role: {
        include: withRoleInclude,
      },
    },
  });
  if (!existingUser) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  assertActorCanManageUser(actorRole, existingUser.role.name);

  const user = await prisma.user.update({
    where: { id },
    data: { isActive },
    include: {
      role: {
        include: withRoleInclude,
      },
    },
  });

  return sanitizeUser(user);
};

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
};
