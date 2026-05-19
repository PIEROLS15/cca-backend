const asyncHandler = require("../../../utils/async-handler");
const authService = require("../services/auth.service");

const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new HttpError(400, "username y password son obligatorios");
  }

  const result = await authService.login({ username, password });
  res.json(result);
});

module.exports = {
  login,
};
