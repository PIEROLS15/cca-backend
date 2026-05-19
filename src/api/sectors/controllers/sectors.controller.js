const asyncHandler = require("../../../utils/async-handler");
const HttpError = require("../../../utils/http-error");
const { sendSuccess } = require("../../../utils/api-response");
const sectorsService = require("../services/sectors.service");

const listSectors = asyncHandler(async (req, res) => {
  const data = await sectorsService.listSectors(req.query);
  return sendSuccess(res, {
    message: "Sectores encontrados correctamente",
    data,
  });
});

const getSectorById = asyncHandler(async (req, res) => {
  const sector = await sectorsService.getSectorById(Number(req.params.id));
  res.json(sector);
});

const createSector = asyncHandler(async (req, res) => {
  if (!req.body.name) {
    throw new HttpError(400, "name es obligatorio");
  }
  const sector = await sectorsService.createSector(req.body);
  res.status(201).json(sector);
});

const updateSector = asyncHandler(async (req, res) => {
  if (!req.body.name) {
    throw new HttpError(400, "name es obligatorio");
  }
  const sector = await sectorsService.updateSector(Number(req.params.id), req.body);
  res.json(sector);
});

const deleteSector = asyncHandler(async (req, res) => {
  await sectorsService.deleteSector(Number(req.params.id));
  res.status(204).send();
});

module.exports = {
  listSectors,
  getSectorById,
  createSector,
  updateSector,
  deleteSector,
};
