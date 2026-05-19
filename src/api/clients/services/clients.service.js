const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const { normalizeClientPayload } = require("../utils/clients.utils");

const listClients = async ({ clientType, page, limit }) => {
  const pagination = getPaginationParams({ page, limit });

  const where = {
    clientType: clientType || undefined,
  };

  const [docs, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { id: "desc" },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.client.count({ where }),
  ]);

  return buildPaginationResult({
    docs,
    total,
    page: pagination.page,
    limit: pagination.limit,
  });
};

const getClientById = async (id) => {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) {
    throw new HttpError(404, "Cliente no encontrado");
  }
  return client;
};

const createClient = async (payload) => {
  return prisma.client.create({
    data: normalizeClientPayload(payload),
  });
};

const updateClient = async (id, payload) => {
  await getClientById(id);
  return prisma.client.update({
    where: { id },
    data: normalizeClientPayload(payload),
  });
};

const deleteClient = async (id) => {
  await getClientById(id);

  const requestsCount = await prisma.certificateRequest.count({ where: { clientId: id } });
  if (requestsCount > 0) {
    throw new HttpError(409, "No se puede eliminar: el cliente tiene solicitudes asociadas");
  }

  await prisma.client.delete({ where: { id } });
};

module.exports = {
  listClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
};
