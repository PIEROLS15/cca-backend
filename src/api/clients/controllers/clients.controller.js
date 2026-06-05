const asyncHandler = require("../../../utils/async-handler");
const HttpError = require("../../../utils/http-error");
const { sendSuccess } = require("../../../utils/api-response");
const clientsService = require("../services/clients.service");
const reniecService = require("../services/reniec.service");

const listClients = asyncHandler(async (req, res) => {
  const data = await clientsService.listClients({
    clientType: req.query.clientType,
    page: req.query.page,
    limit: req.query.limit,
  });
  return sendSuccess(res, {
    message: "Clientes encontrados correctamente",
    data,
  });
});

const getClientById = asyncHandler(async (req, res) => {
  const client = await clientsService.getClientById(Number(req.params.id));
  res.json(client);
});

const createClient = asyncHandler(async (req, res) => {
  const { fullName, documentNumber, isComunero } = req.body;
  if (!fullName || !documentNumber || isComunero === undefined) {
    throw new HttpError(400, "fullName, documentNumber e isComunero son obligatorios");
  }

  const client = await clientsService.createClient(req.body);
  res.status(201).json(client);
});

const updateClient = asyncHandler(async (req, res) => {
  const client = await clientsService.updateClient(Number(req.params.id), req.body);
  res.json(client);
});

const deleteClient = asyncHandler(async (req, res) => {
  await clientsService.deleteClient(Number(req.params.id));
  res.status(204).send();
});

const searchByDocument = asyncHandler(async (req, res) => {
  const { document } = req.params;

  if (!document || document.length < 3) {
    throw new HttpError(400, "Ingrese al menos 3 caracteres para buscar");
  }

  const client = await clientsService.searchByDocument(document);
  res.json(client);
});

const searchReniec = asyncHandler(async (req, res) => {
  const { document } = req.params;

  if (!document || document.length < 8) {
    throw new HttpError(400, "Ingrese un DNI válido (8 dígitos)");
  }

  const person = await reniecService.searchByDocument(document);
  res.json(person);
});

module.exports = {
  listClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  searchByDocument,
  searchReniec,
};
