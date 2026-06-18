const HttpError = require("../utils/http-error");
const { canAccessModule, getRoleGroup } = require("../utils/access-control.utils");

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const requireModuleAccess = (moduleKey, options = {}) => (req, res, next) => {
  if (!req.user) {
    return next(new HttpError(401, "No autenticado"));
  }

  const roleName = req.user.role || req.user.roleName;
  const roleGroup = getRoleGroup(roleName);

  if (Array.isArray(options.readOnlyGroups) && options.readOnlyGroups.includes(roleGroup) && READ_ONLY_METHODS.has(req.method)) {
    return next();
  }

  if (!canAccessModule(roleName, moduleKey)) {
    return next(new HttpError(403, "No autorizado para esta accion"));
  }

  return next();
};

module.exports = {
  requireModuleAccess,
};
