const jwt = require("jsonwebtoken");

const createAccessToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      role: user.role?.name,
      roleId: user.role?.id,
      permissions: user.role?.rolePermissions?.map((item) => item.permission.key) || [],
      username: user.username,
    },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "8h" }
  );

const sanitizeUser = (user) => ({
  id: user.id,
  username: user.username,
  fullName: user.fullName,
  email: user.email,
  dni: user.dni,
  isActive: user.isActive,
  role: user.role
    ? {
        id: user.role.id,
        name: user.role.name,
        description: user.role.description,
        permissions: user.role.rolePermissions?.map((item) => item.permission.key) || [],
      }
    : null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

module.exports = {
  createAccessToken,
  sanitizeUser,
};
