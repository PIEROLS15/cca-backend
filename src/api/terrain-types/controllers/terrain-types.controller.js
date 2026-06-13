const asyncHandler = require("../../../utils/async-handler");
const HttpError = require("../../../utils/http-error");
const { sendSuccess } = require("../../../utils/api-response");
const terrainTypesService = require("../services/terrain-types.service");

const listTerrainTypes = asyncHandler(async (req, res) => {
  const data = await terrainTypesService.listTerrainTypes(req.query);
  return sendSuccess(res, {
    message: "Tipos de terreno encontrados correctamente",
    data,
  });
});

const getTerrainTypeById = asyncHandler(async (req, res) => {
  const terrainType = await terrainTypesService.getTerrainTypeById(Number(req.params.id));
  res.json(terrainType);
});

const previewDeleteTerrainType = asyncHandler(async (req, res) => {
  const preview = await terrainTypesService.getTerrainTypeDeletePreview(Number(req.params.id), req.user?.roleGroup);
  res.json(preview);
});

const createTerrainType = asyncHandler(async (req, res) => {
  if (!req.body.name) {
    throw new HttpError(400, "name es obligatorio");
  }
  const terrainType = await terrainTypesService.createTerrainType(req.body);
  res.status(201).json(terrainType);
});

const updateTerrainType = asyncHandler(async (req, res) => {
  if (!req.body.name) {
    throw new HttpError(400, "name es obligatorio");
  }
  const terrainType = await terrainTypesService.updateTerrainType(Number(req.params.id), req.body);
  res.json(terrainType);
});

const deleteTerrainType = asyncHandler(async (req, res) => {
  await terrainTypesService.deleteTerrainType(Number(req.params.id), req.user?.roleGroup);
  res.status(204).send();
});

module.exports = {
  listTerrainTypes,
  getTerrainTypeById,
  previewDeleteTerrainType,
  createTerrainType,
  updateTerrainType,
  deleteTerrainType,
};
