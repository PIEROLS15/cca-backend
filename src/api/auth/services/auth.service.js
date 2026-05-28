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

module.exports = {
  login,
  me,
};
