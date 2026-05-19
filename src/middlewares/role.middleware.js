const HttpError = require("../utils/http-error");

const normalizeRoleName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[_\s-]/g, "");

const requireRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(new HttpError(401, "No autenticado"));
  }

  const normalizedUserRole = normalizeRoleName(req.user.role);
  const normalizedAllowedRoles = allowedRoles.map(normalizeRoleName);

  if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
    return next(new HttpError(403, "No autorizado para esta accion"));
  }

  return next();
};

module.exports = {
  requireRoles,
};
