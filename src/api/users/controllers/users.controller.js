const asyncHandler = require("../../../utils/async-handler");
const HttpError = require("../../../utils/http-error");
const { sendSuccess } = require("../../../utils/api-response");
const usersService = require("../services/users.service");

const listUsers = asyncHandler(async (req, res) => {
  const filters = {
    ...req.query,
  };

  if (req.query.roleId !== undefined) {
    const roleId = Number(req.query.roleId);
    if (Number.isNaN(roleId)) {
      throw new HttpError(400, "roleId debe ser numerico");
    }
    filters.roleId = roleId;
  }

  if (req.query.isActive !== undefined) {
    if (req.query.isActive !== "true" && req.query.isActive !== "false") {
      throw new HttpError(400, "isActive debe ser true o false");
    }
    filters.isActive = req.query.isActive === "true";
  }

  const data = await usersService.listUsers(filters);
  return sendSuccess(res, {
    message: "Usuarios encontrados correctamente",
    data,
  });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await usersService.getUserById(Number(req.params.id));
  res.json(user);
});

const createUser = asyncHandler(async (req, res) => {
  const { username, password, fullName, email, dni, roleId } = req.body;

  if (!username || !password || !fullName || !email || !dni || !roleId) {
    throw new HttpError(400, "username, password, fullName, email, dni y roleId son obligatorios");
  }

  const user = await usersService.createUser({
    ...req.body,
    roleId: Number(req.body.roleId),
  }, req.user?.role);
  res.status(201).json(user);
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await usersService.updateUser(Number(req.params.id), {
    ...req.body,
    roleId: req.body.roleId ? Number(req.body.roleId) : undefined,
  }, req.user?.role);
  res.json(user);
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  if (typeof isActive !== "boolean") {
    throw new HttpError(400, "isActive debe ser boolean");
  }

  const user = await usersService.updateUserStatus(Number(req.params.id), isActive, req.user?.role);
  res.json(user);
});

const deleteUser = asyncHandler(async (req, res) => {
  await usersService.deleteUser(Number(req.params.id), req.user?.role);
  res.status(204).send();
});

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
};
