const HttpError = require("../utils/http-error");
const { canAccessModule } = require("../utils/access-control.utils");

const requireModuleAccess = (moduleKey) => (req, res, next) => {
  if (!req.user) {
    return next(new HttpError(401, "No autenticado"));
  }

  if (!canAccessModule(req.user.role || req.user.roleName, moduleKey)) {
    return next(new HttpError(403, "No autorizado para esta accion"));
  }

  return next();
};

module.exports = {
  requireModuleAccess,
};
