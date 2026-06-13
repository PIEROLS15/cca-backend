const { Prisma } = require("@prisma/client");
const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const { makeDeletionPreview, makeImpactItem } = require("../../../utils/deletion-preview");
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

const listClients = async ({ clientType, page, limit, search, documentNumber }) => {
  const pagination = getPaginationParams({ page, limit });

  const where = {};

  if (clientType === "Comunero") {
    where.commoner = { isNot: null };
  } else if (clientType === "Tercero") {
    where.commoner = null;
  }

  if (search) {
    const searchOr = [
      { fullName: { contains: search, mode: "insensitive" } },
      { documentNumber: { contains: search, mode: "insensitive" } },
    ];

    const normalizedSearch = String(search).trim();
    if (/^\d+$/.test(normalizedSearch)) {
      searchOr.push({ commoner: { is: { licenseSequence: Number(normalizedSearch) } } });
    }

    where.OR = searchOr;
  }

  if (documentNumber) {
    where.documentNumber = { contains: documentNumber, mode: "insensitive" };
  }

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

const getClientDeletePreview = async (id) => {
  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      fullName: true,
      documentNumber: true,
      commoner: true,
      _count: {
        select: {
          certificates: true,
          partnerCertificates: true,
          certificateRequests: true,
          partnerRequests: true,
          assemblyRecordRequests: true,
          certificateOwners: true,
        },
      },
    },
  });

  if (!client) {
    throw new HttpError(404, "Cliente no encontrado");
  }

  return makeDeletionPreview({
    entityLabel: "cliente",
    itemName: `${client.fullName} (${client.documentNumber})`,
    willDelete: client.commoner
      ? [makeImpactItem({ label: "Ficha de comunero", count: 1 })]
      : [],
    willSetNull: [
      ...(client._count.partnerCertificates > 0
        ? [makeImpactItem({ label: "Certificados donde figura como copropietario", count: client._count.partnerCertificates })]
        : []),
      ...(client._count.partnerRequests > 0
        ? [makeImpactItem({ label: "Solicitudes de certificado donde figura como copropietario", count: client._count.partnerRequests })]
        : []),
    ],
    willBlock: [
      ...(client._count.certificates > 0
        ? [makeImpactItem({ label: "Certificados donde es titular", count: client._count.certificates })]
        : []),
      ...(client._count.certificateRequests > 0
        ? [makeImpactItem({ label: "Solicitudes de certificado donde es titular", count: client._count.certificateRequests })]
        : []),
      ...(client._count.assemblyRecordRequests > 0
        ? [makeImpactItem({ label: "Solicitudes de acta vinculadas", count: client._count.assemblyRecordRequests })]
        : []),
      ...(client._count.certificateOwners > 0
        ? [makeImpactItem({ label: "Registros de propietario en certificados", count: client._count.certificateOwners })]
        : []),
    ],
  });
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
  const preview = await getClientDeletePreview(id);
  if (!preview.canDelete) {
    throw new HttpError(409, "No se puede eliminar el cliente porque tiene dependencias asociadas");
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
  getClientDeletePreview,
  searchByDocument,
};
