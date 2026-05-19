const sanitizeRole = (role) => ({
  id: role.id,
  name: role.name,
  description: role.description,
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
