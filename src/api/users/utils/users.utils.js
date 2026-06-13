const { getRoleGroup } = require("../../../utils/access-control.utils");

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
        group: getRoleGroup(user.role.name),
        permissions: user.role.rolePermissions?.map((item) => item.permission.key) || [],
      }
    : null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

module.exports = {
  sanitizeUser,
};
