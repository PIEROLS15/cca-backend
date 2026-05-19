const asyncHandler = require("../../../utils/async-handler");
const HttpError = require("../../../utils/http-error");
const { sendSuccess } = require("../../../utils/api-response");
const rolesService = require("../services/roles.service");

const listRoles = asyncHandler(async (req, res) => {
  const data = await rolesService.listRoles(req.query);
  return sendSuccess(res, {
    message: "Roles encontrados correctamente",
    data,
  });
});

const getRoleById = asyncHandler(async (req, res) => {
  const data = await rolesService.getRoleById(Number(req.params.id));
  return sendSuccess(res, {
    message: "Rol encontrado correctamente",
    data,
  });
});

const createRole = asyncHandler(async (req, res) => {
  if (!req.body.name) {
    throw new HttpError(400, "name es obligatorio");
  }

  const data = await rolesService.createRole(req.body);
  return sendSuccess(res, {
    message: "Rol creado correctamente",
    data,
    status: 201,
  });
});

const updateRole = asyncHandler(async (req, res) => {
  const data = await rolesService.updateRole(Number(req.params.id), req.body);
  return sendSuccess(res, {
    message: "Rol actualizado correctamente",
    data,
  });
});

const deleteRole = asyncHandler(async (req, res) => {
  await rolesService.deleteRole(Number(req.params.id));
  return sendSuccess(res, {
    message: "Rol eliminado correctamente",
    data: null,
  });
});

module.exports = {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
};
