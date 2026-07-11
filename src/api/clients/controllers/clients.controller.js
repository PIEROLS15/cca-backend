const asyncHandler = require("../../../utils/async-handler");
const HttpError = require("../../../utils/http-error");
const { sendSuccess } = require("../../../utils/api-response");
const clientsService = require("../services/clients.service");
const reniecService = require("../services/reniec.service");

const parseBooleanLike = (value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "si", "sí", "yes"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return Boolean(value);
};

const resolveIsComunero = (body) => {
  if (body.isComunero !== undefined) {
    return parseBooleanLike(body.isComunero);
  }

  if (body.clientType === "Comunero") {
    return true;
  }

  if (body.clientType === "Tercero") {
    return false;
  }

  return undefined;
};

const listClients = asyncHandler(async (req, res) => {
  const data = await clientsService.listClients({
    clientType: req.query.clientType,
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search,
    documentNumber: req.query.documentNumber,
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
  const { fullName, documentNumber } = req.body;
  const resolvedIsComunero = resolveIsComunero(req.body);

  if (!fullName || !documentNumber || resolvedIsComunero === undefined) {
    throw new HttpError(400, "Completa los campos obligatorios para registrar el cliente");
  }

  const client = await clientsService.createClient({
    ...req.body,
    isComunero: resolvedIsComunero,
  }, req.user?.role);
  res.status(201).json(client);
});

const updateClient = asyncHandler(async (req, res) => {
  const resolvedIsComunero = resolveIsComunero(req.body);
  const payload = resolvedIsComunero === undefined
    ? req.body
    : { ...req.body, isComunero: resolvedIsComunero };

  const client = await clientsService.updateClient(Number(req.params.id), payload, req.user?.role);
  res.json(client);
});

const deleteClient = asyncHandler(async (req, res) => {
  await clientsService.deleteClient(Number(req.params.id));
  res.status(204).send();
});

const previewDeleteClient = asyncHandler(async (req, res) => {
  const preview = await clientsService.getClientDeletePreview(Number(req.params.id));
  res.json(preview);
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
  previewDeleteClient,
  searchByDocument,
  searchReniec,
};
