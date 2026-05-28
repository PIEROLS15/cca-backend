const asyncHandler = require("../../../utils/async-handler");
const authService = require("../services/auth.service");

const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new HttpError(400, "username y password son obligatorios");
  }

  const result = await authService.login({ username, password });

  res.cookie("token", result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000,
  });

  res.json({ user: result.user });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.me(req.user.sub);
  res.json({ user });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  res.json({ message: "Sesión cerrada correctamente" });
});

module.exports = {
  login,
  me,
  logout,
};
