const ROLE_GROUPS = [
  { group: 1, roles: ["SuperAdmin", "Admin"] },
  { group: 2, roles: ["Presidente", "Ingeniero"] },
  { group: 3, roles: ["Secretaria", "Supervisor"] },
  { group: 4, roles: ["Asistente", "AtencionCliente"] },
];

const MODULE_ACCESS_BY_GROUP = {
  1: ["dashboard", "roles", "users", "sectors", "terrain-types", "clients", "certificate-requests", "certificates", "assembly-record-requests", "reports"],
  2: ["dashboard", "roles", "users", "sectors", "terrain-types", "clients", "certificate-requests", "certificates", "assembly-record-requests", "reports"],
  3: ["dashboard", "roles", "sectors", "terrain-types", "clients", "certificate-requests", "certificates", "assembly-record-requests", "reports"],
  4: ["dashboard", "clients", "certificate-requests", "assembly-record-requests"],
};

const normalizeRoleName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[_\s-]/g, "");

const getRoleGroup = (roleName) => {
  const normalized = normalizeRoleName(roleName);
  const match = ROLE_GROUPS.find((item) => item.roles.some((role) => normalizeRoleName(role) === normalized));
  return match?.group || null;
};

const getAllowedModuleKeys = (roleName) => {
  const group = getRoleGroup(roleName);
  return group ? MODULE_ACCESS_BY_GROUP[group] || [] : [];
};

const canAccessModule = (roleName, moduleKey) => getAllowedModuleKeys(roleName).includes(moduleKey);

const canManageUserRole = (actorRoleName, targetRoleName) => {
  const actorGroup = getRoleGroup(actorRoleName);
  const targetGroup = getRoleGroup(targetRoleName);

  if (!actorGroup || !targetGroup) {
    return false;
  }

  if (actorGroup === 1) {
    return targetGroup !== 1;
  }

  if (actorGroup === 2) {
    return targetGroup === 3 || targetGroup === 4;
  }

  return false;
};

const canManageCertificateLimit = (actorRoleName) => {
  const actorGroup = getRoleGroup(actorRoleName);

  if (!actorGroup) {
    return false;
  }

  return [1, 2].includes(actorGroup);
};

module.exports = {
  ROLE_GROUPS,
  MODULE_ACCESS_BY_GROUP,
  normalizeRoleName,
  getRoleGroup,
  getAllowedModuleKeys,
  canAccessModule,
  canManageUserRole,
  canManageCertificateLimit,
};
