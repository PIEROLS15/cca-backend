const jwt = require("jsonwebtoken");
const HttpError = require("../utils/http-error");

const authRequired = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new HttpError(401, "Token no proporcionado"));
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    req.user = payload;
    return next();
  } catch (error) {
    return next(new HttpError(401, "Token invalido o expirado"));
  }
};

module.exports = {
  authRequired,
};
