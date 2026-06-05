const bcrypt = require("bcryptjs");
const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { withRoleInclude } = require("../../../utils/role.utils");
const { createAccessToken, sanitizeUser } = require("../utils/auth.utils");

const me = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: withRoleInclude,
      },
    },
  });

  if (!user) {
    throw new HttpError(401, "Usuario no encontrado");
  }

  if (user.isActive === false) {
    throw new HttpError(403, "Usuario inactivo");
  }

  return sanitizeUser(user);
};

const login = async ({ username, password }) => {
  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      role: {
        include: withRoleInclude,
      },
    },
  });

  if (!user) {
    throw new HttpError(401, "Credenciales invalidas");
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw new HttpError(401, "Credenciales invalidas");
  }

  if (user.isActive === false) {
    throw new HttpError(403, "Usuario inactivo");
  }

  const token = createAccessToken(user);

  return {
    token,
    user: sanitizeUser(user),
  };
};

const updateProfile = async (userId, { fullName, username, email, dni }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  if (username && username !== user.username) {
    const duplicate = await prisma.user.findUnique({ where: { username } });
    if (duplicate) {
      throw new HttpError(409, "El nombre de usuario ya existe");
    }
  }

  if (email && email !== user.email) {
    const existingByEmail = await prisma.user.findFirst({
      where: { email, id: { not: userId } },
      select: { id: true },
    });
    if (existingByEmail) {
      throw new HttpError(409, "El email ya esta en uso");
    }
  }

  if (dni && dni !== user.dni) {
    const existingByDni = await prisma.user.findFirst({
      where: { dni, id: { not: userId } },
      select: { id: true },
    });
    if (existingByDni) {
      throw new HttpError(409, "El DNI ya esta en uso");
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { fullName, username, email, dni },
    include: {
      role: {
        include: withRoleInclude,
      },
    },
  });

  return sanitizeUser(updated);
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true },
  });

  if (!user) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    throw new HttpError(400, "La contraseña actual no es correcta");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });
};

const verifyPassword = async (userId, password) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true },
  });

  if (!user) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new HttpError(400, "La contraseña actual no es correcta");
  }
};

module.exports = {
  login,
  me,
  updateProfile,
  changePassword,
  verifyPassword,
};
