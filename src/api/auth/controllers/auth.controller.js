const asyncHandler = require("../../../utils/async-handler");
const HttpError = require("../../../utils/http-error");
const authService = require("../services/auth.service");

function getAuthCookieOptions({ includeMaxAge = true } = {}) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };

  if (includeMaxAge) {
    options.maxAge = 8 * 60 * 60 * 1000;
  }

  const cookieDomain = process.env.COOKIE_DOMAIN;

  if (cookieDomain) {
    const normalizedDomain = cookieDomain.trim().replace(/^\./, "");

    if (!normalizedDomain.includes(",") && !normalizedDomain.includes(":") && !normalizedDomain.includes("//")) {
      options.domain = normalizedDomain;
    }

    return options;
  }

  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl || frontendUrl.includes(",")) return options;

  try {
    const hostname = new URL(frontendUrl).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return options;
    }

    options.domain = hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    // Si FRONTEND_URL no es una URL válida, usamos la cookie sin domain.
  }

  return options;
}

const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new HttpError(400, "username y password son obligatorios");
  }

  const result = await authService.login({ username, password });

  res.cookie("token", result.token, getAuthCookieOptions());

  res.json({ user: result.user });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.me(req.user.sub);
  res.json({ user });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie("token", getAuthCookieOptions({ includeMaxAge: false }));
  res.json({ message: "Sesión cerrada correctamente" });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, username, email, dni } = req.body;

  if (!fullName || !username) {
    throw new HttpError(400, "fullName y username son obligatorios");
  }

  const user = await authService.updateProfile(req.user.sub, {
    fullName: fullName.trim(),
    username: username.trim(),
    email: email ? email.trim() : undefined,
    dni: dni ? dni.trim() : undefined,
  });

  res.json({ user });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new HttpError(400, "currentPassword y newPassword son obligatorios");
  }

  if (newPassword.length < 6) {
    throw new HttpError(400, "La nueva contraseña debe tener al menos 6 caracteres");
  }

  await authService.changePassword(req.user.sub, { currentPassword, newPassword });
  res.json({ message: "Contraseña actualizada correctamente" });
});

const verifyPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) {
    throw new HttpError(400, "password es obligatorio");
  }

  await authService.verifyPassword(req.user.sub, password);
  res.json({ message: "Contraseña verificada correctamente" });
});

module.exports = {
  login,
  me,
  logout,
  updateProfile,
  changePassword,
  verifyPassword,
};
