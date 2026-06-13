const { getRoleGroup } = require("../../../utils/access-control.utils");

const sanitizeRole = (role) => ({
  id: role.id,
  name: role.name,
  description: role.description,
  group: getRoleGroup(role.name),
  permissions: role.rolePermissions?.map((item) => ({
    id: item.permission.id,
    key: item.permission.key,
    description: item.permission.description,
  })) || [],
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
});

module.exports = {
  sanitizeRole,
};
