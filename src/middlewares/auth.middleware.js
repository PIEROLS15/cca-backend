const jwt = require("jsonwebtoken");
const HttpError = require("../utils/http-error");

const authRequired = (req, res, next) => {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next(new HttpError(401, "Token no proporcionado"));
  }

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
