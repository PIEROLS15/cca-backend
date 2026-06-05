const { Prisma } = require("@prisma/client");
const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const {
  buildClientWriteData,
  formatClientCollection,
  formatClientResponse,
} = require("../utils/clients.utils");

const MAX_LICENSE_RETRIES = 3;

const isLicenseRaceError = (error) => {
  if (error?.code === "P2034") {
    return true;
  }

  return error?.code === "P2002"
    && Array.isArray(error?.meta?.target)
    && error.meta.target.includes("licenseSequence");
};

const runClientWriteTransaction = async (handler) => {
  let attempt = 0;

  while (attempt < MAX_LICENSE_RETRIES) {
    try {
      return await prisma.$transaction(
        async (tx) => handler(tx),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      attempt += 1;

      if (!isLicenseRaceError(error) || attempt >= MAX_LICENSE_RETRIES) {
        throw error;
      }
    }
  }
};

const getClientRecordById = async (id, db = prisma) => {
  const client = await db.client.findUnique({
    where: { id },
    include: { commoner: true },
  });
  if (!client) {
    throw new HttpError(404, "Cliente no encontrado");
  }

  return client;
};

const listClients = async ({ clientType, page, limit }) => {
  const pagination = getPaginationParams({ page, limit });

  const where = clientType === "Comunero"
    ? { commoner: { isNot: null } }
    : clientType === "Tercero"
      ? { commoner: null }
      : {};

  const [docs, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: { commoner: true },
      orderBy: clientType === "Comunero"
        ? { commoner: { licenseSequence: "desc" } }
        : { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.client.count({ where }),
  ]);

  return buildPaginationResult({
    docs: formatClientCollection(docs),
    total,
    page: pagination.page,
    limit: pagination.limit,
  });
};

const getClientById = async (id) => {
  return formatClientResponse(await getClientRecordById(id));
};

const createClient = async (payload) => {
  return runClientWriteTransaction(async (tx) => {
    const data = await buildClientWriteData(tx, payload);
    const client = await tx.client.create({
      data,
      include: { commoner: true },
    });

    return formatClientResponse(client);
  });
};

const updateClient = async (id, payload) => {
  return runClientWriteTransaction(async (tx) => {
    const currentClient = await getClientRecordById(id, tx);
    const data = await buildClientWriteData(tx, payload, currentClient);
    const client = await tx.client.update({
      where: { id },
      data,
      include: { commoner: true },
    });

    return formatClientResponse(client);
  });
};

const upsertClientByDocument = async (documentNumber, payload) => {
  return runClientWriteTransaction(async (tx) => {
    const currentClient = await tx.client.findUnique({
      where: { documentNumber },
      include: { commoner: true },
    });

    const data = await buildClientWriteData(
      tx,
      { ...payload, documentNumber },
      currentClient,
    );

    if (currentClient) {
      return tx.client.update({
        where: { id: currentClient.id },
        data,
        include: { commoner: true },
      });
    }

    return tx.client.create({
      data: { ...data, documentNumber },
      include: { commoner: true },
    });
  });
};

const deleteClient = async (id) => {
  await getClientRecordById(id);

  const requestsCount = await prisma.certificateRequest.count({ where: { clientId: id } });
  if (requestsCount > 0) {
    throw new HttpError(409, "No se puede eliminar: el cliente tiene solicitudes asociadas");
  }

  await prisma.client.delete({ where: { id } });
};

const searchByDocument = async (document) => {
  const client = await prisma.client.findFirst({
    where: { documentNumber: { contains: document } },
    include: { commoner: true },
  });

  if (!client) {
    throw new HttpError(404, "No se encontró ningún cliente con ese documento");
  }

  return formatClientResponse(client);
};

module.exports = {
  listClients,
  getClientById,
  createClient,
  updateClient,
  upsertClientByDocument,
  deleteClient,
  searchByDocument,
};
