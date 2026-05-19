const bcrypt = require("bcryptjs");
const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const { resolveRoleForUser, withRoleInclude } = require("../../../utils/role.utils");
const { sanitizeUser } = require("../utils/users.utils");

const normalizeEmail = (value) => (value ? String(value).trim().toLowerCase() : null);
const normalizeDni = (value) => (value ? String(value).trim() : null);

const assertUniqueUserFields = async ({ email, dni, excludeUserId }) => {
  if (email) {
    const existingByEmail = await prisma.user.findFirst({
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
    const existingByDni = await prisma.user.findFirst({
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

  const where = {
    roleId: query.roleId || undefined,
    isActive: typeof query.isActive === "boolean" ? query.isActive : undefined,
  };

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

const createUser = async ({ username, password, fullName, email, dni, roleId }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedDni = normalizeDni(dni);

  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) {
    throw new HttpError(409, "El nombre de usuario ya existe");
  }

  await assertUniqueUserFields({ email: normalizedEmail, dni: normalizedDni });

  const hashedPassword = await bcrypt.hash(password, 10);
  const resolvedRole = await resolveRoleForUser({ roleId });

  const user = await prisma.user.create({
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
};

const updateUser = async (id, payload) => {
  const existingUser = await prisma.user.findUnique({ where: { id } });
  if (!existingUser) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const data = {
    fullName: payload.fullName,
    roleId: undefined,
  };

  if (payload.roleId) {
    const resolvedRole = await resolveRoleForUser({ roleId: payload.roleId });
    data.roleId = resolvedRole.id;
  }

  if (payload.email && payload.email !== existingUser.email) {
    const normalizedEmail = normalizeEmail(payload.email);
    await assertUniqueUserFields({ email: normalizedEmail, excludeUserId: id });
    data.email = normalizedEmail;
  }

  if (payload.dni && payload.dni !== existingUser.dni) {
    const normalizedDni = normalizeDni(payload.dni);
    await assertUniqueUserFields({ dni: normalizedDni, excludeUserId: id });
    data.dni = normalizedDni;
  }

  if (!payload.fullName) {
    delete data.fullName;
  }

  if (payload.password) {
    data.password = await bcrypt.hash(payload.password, 10);
  }

  if (payload.username && payload.username !== existingUser.username) {
    const duplicate = await prisma.user.findUnique({ where: { username: payload.username } });
    if (duplicate) {
      throw new HttpError(409, "El nombre de usuario ya existe");
    }
    data.username = payload.username;
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    include: {
      role: {
        include: withRoleInclude,
      },
    },
  });

  return sanitizeUser(user);
};

const deleteUser = async (id) => {
  await getUserById(id);
  await prisma.user.delete({ where: { id } });
};

const updateUserStatus = async (id, isActive) => {
  const existingUser = await prisma.user.findUnique({ where: { id } });
  if (!existingUser) {
    throw new HttpError(404, "Usuario no encontrado");
  }

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
