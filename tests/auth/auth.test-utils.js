const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const prisma = require("../../src/config/prisma");
const { createAccessToken } = require("../../src/api/auth/utils/auth.utils");

const uniqueSuffix = () => `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

const getBaseRole = async () => {
  const role = await prisma.role.findFirst({
    orderBy: { id: "asc" },
    include: {
      rolePermissions: {
        include: {
          permission: true,
        },
      },
    },
  });

  if (!role) {
    throw new Error("No se encontró un rol base en la DB de test");
  }

  return role;
};

const createAuthUserFixture = async (overrides = {}) => {
  const role = overrides.role || await getBaseRole();
  const password = overrides.password || `Test1234!${uniqueSuffix()}`;
  const passwordHash = overrides.passwordHash || await bcrypt.hash(password, 10);
  const id = overrides.id || crypto.randomInt(1000000000, 2000000000);

  const user = await prisma.user.create({
    data: {
      id,
      username: overrides.username || `auth-${uniqueSuffix()}`,
      password: passwordHash,
      fullName: overrides.fullName || "Auth Fixture User",
      email: overrides.email === undefined ? `auth-${uniqueSuffix()}@example.com` : overrides.email,
      dni: overrides.dni === undefined ? `${crypto.randomInt(10000000, 99999999)}` : overrides.dni,
      isActive: overrides.isActive ?? true,
      certificateRangeStart: overrides.certificateRangeStart ?? null,
      certificateRangeEnd: overrides.certificateRangeEnd ?? null,
      lastCertificate: overrides.lastCertificate ?? null,
      roleId: role.id,
    },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  return { user, password, role };
};

const removeAuthUserFixture = async (id) => {
  if (!id) return;

  await prisma.user.deleteMany({ where: { id } });
};

const refreshAuthUser = async (id) => prisma.user.findUnique({
  where: { id },
  include: {
    role: {
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    },
  },
});

const makeAuthToken = (user) => createAccessToken(user);

module.exports = {
  createAuthUserFixture,
  removeAuthUserFixture,
  refreshAuthUser,
  makeAuthToken,
  getBaseRole,
};
