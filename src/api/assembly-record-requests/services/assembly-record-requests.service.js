const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const { buildAssemblyRequestCode } = require("../utils/assembly-record-requests.utils");

const nextCode = async () => {
  const lastRequest = await prisma.assemblyRecordRequest.findFirst({
    orderBy: { id: "desc" },
    select: { id: true },
  });

  return buildAssemblyRequestCode((lastRequest?.id || 0) + 1);
};

const listAssemblyRecordRequests = async ({ page, limit, search }) => {
  const pagination = getPaginationParams({ page, limit });

  const where = {};
  if (search) {
    where.client = {
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { documentNumber: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const [docs, total] = await Promise.all([
    prisma.assemblyRecordRequest.findMany({
      where,
      include: {
        client: true,
        certificate: true,
        user: true,
      },
      orderBy: { id: "desc" },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.assemblyRecordRequest.count({ where }),
  ]);

  return buildPaginationResult({
    docs,
    total,
    page: pagination.page,
    limit: pagination.limit,
  });
};

const getAssemblyRecordRequestById = async (id) => {
  const request = await prisma.assemblyRecordRequest.findUnique({
    where: { id },
    include: {
      client: true,
      certificate: true,
      user: true,
    },
  });

  if (!request) {
    throw new HttpError(404, "Solicitud de acta no encontrada");
  }

  return request;
};

const getAssemblyRecordRequestByCode = async (code) => {
  const request = await prisma.assemblyRecordRequest.findUnique({
    where: { code },
    include: {
      client: true,
      certificate: true,
      user: true,
    },
  });

  if (!request) {
    throw new HttpError(404, "Solicitud de acta no encontrada");
  }

  return request;
};

const createAssemblyRecordRequest = async ({ clientId, certificateId, description }, userId) => {
  const certificate = await prisma.certificate.findUnique({ where: { id: certificateId } });
  if (!certificate) {
    throw new HttpError(400, "Debe existir un certificado previo para crear la solicitud");
  }

  const code = await nextCode();

  return prisma.assemblyRecordRequest.create({
    data: {
      code,
      clientId,
      certificateId,
      userId,
      description: description || null,
    },
    include: {
      client: true,
      certificate: true,
      user: true,
    },
  });
};

const updateAssemblyRecordRequest = async (id, payload) => {
  await getAssemblyRecordRequestById(id);
  return prisma.assemblyRecordRequest.update({
    where: { id },
    data: {
      description: payload.description,
    },
    include: {
      client: true,
      certificate: true,
      user: true,
    },
  });
};

const deleteAssemblyRecordRequest = async (id) => {
  await getAssemblyRecordRequestById(id);
  await prisma.assemblyRecordRequest.delete({ where: { id } });
};

module.exports = {
  listAssemblyRecordRequests,
  getAssemblyRecordRequestById,
  getAssemblyRecordRequestByCode,
  createAssemblyRecordRequest,
  updateAssemblyRecordRequest,
  deleteAssemblyRecordRequest,
};
