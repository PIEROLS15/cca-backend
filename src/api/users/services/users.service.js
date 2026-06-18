const bcrypt = require("bcryptjs");
const { Prisma } = require("@prisma/client");
const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { buildPaginationResult, getPaginationParams } = require("../../../utils/pagination");
const { resolveRoleForUser, withRoleInclude } = require("../../../utils/role.utils");
const { canManageUserRole, canManageCertificateLimit } = require("../../../utils/access-control.utils");
const {
  CERTIFICATE_RANGE_DEFAULT_LENGTH,
  formatCertificateSequence,
  normalizeCertificateSequenceInput,
  resolveCertificateRangeBounds,
} = require("../../../utils/certificate-range.utils");
const { sanitizeUser } = require("../utils/users.utils");

const normalizeEmail = (value) => (value ? String(value).trim().toLowerCase() : null);
const normalizeDni = (value) => (value ? String(value).trim() : null);

const MAX_USER_WRITE_RETRIES = 3;

const runUserWriteTransaction = async (handler) => {
  let attempt = 0;

  while (attempt < MAX_USER_WRITE_RETRIES) {
    try {
      return await prisma.$transaction(
        async (tx) => handler(tx),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      attempt += 1;

      if (error?.code !== "P2034" || attempt >= MAX_USER_WRITE_RETRIES) {
        throw error;
      }
    }
  }
};

const normalizeCertificateRangePayload = (payload = {}) => {
  const hasStart = Object.prototype.hasOwnProperty.call(payload, "certificateRangeStart");
  const hasEnd = Object.prototype.hasOwnProperty.call(payload, "certificateRangeEnd");

  if (!hasStart && !hasEnd) {
    return { start: undefined, end: undefined };
  }

  const start = normalizeCertificateSequenceInput(payload.certificateRangeStart);
  const end = normalizeCertificateSequenceInput(payload.certificateRangeEnd);

  if (Number.isNaN(start)) {
    throw new HttpError(400, "certificateRangeStart debe ser un numero entero positivo");
  }

  if (Number.isNaN(end)) {
    throw new HttpError(400, "certificateRangeEnd debe ser un numero entero positivo");
  }

  const resolved = resolveCertificateRangeBounds({ start, end, length: CERTIFICATE_RANGE_DEFAULT_LENGTH });

  if (Number.isNaN(resolved.start) || Number.isNaN(resolved.end)) {
    throw new HttpError(400, "El rango de certificados es invalido");
  }

  if ((resolved.start !== null && resolved.start <= 0) || (resolved.end !== null && resolved.end <= 0)) {
    throw new HttpError(400, "El rango de certificados debe ser positivo");
  }

  if (resolved.start !== null && resolved.end !== null && resolved.start > resolved.end) {
    throw new HttpError(400, "certificateRangeStart no puede ser mayor que certificateRangeEnd");
  }

  return resolved;
};

const findOverlappingCertificateRange = async (tx, { start, end, excludeUserId }) => {
  if (start == null || end == null) {
    return null;
  }

  const overlapping = await tx.user.findFirst({
    where: {
      id: excludeUserId ? { not: excludeUserId } : undefined,
      certificateRangeStart: { not: null },
      certificateRangeEnd: { not: null },
      AND: [
        { certificateRangeStart: { lte: end } },
        { certificateRangeEnd: { gte: start } },
      ],
    },
    select: {
      id: true,
      fullName: true,
      username: true,
      certificateRangeStart: true,
      certificateRangeEnd: true,
    },
  });

  return overlapping;
};

const assertCertificateRangeAvailability = async (tx, { start, end, excludeUserId }) => {
  if (start == null || end == null) {
    return;
  }

  const conflict = await findOverlappingCertificateRange(tx, { start, end, excludeUserId });
  if (conflict) {
    throw new HttpError(
      409,
      `El rango ${String(start).padStart(6, "0")} - ${String(end).padStart(6, "0")} se superpone con ${conflict.fullName}`
    );
  }
};

const assertCertificateNumbersAvailability = async (tx, { start, end, excludeUserId }) => {
  if (start == null || end == null) {
    return;
  }

  const conflict = await tx.certificate.findFirst({
    where: {
      certificateNumber: {
        gte: formatCertificateSequence(start),
        lte: formatCertificateSequence(end),
      },
      userId: excludeUserId ? { not: excludeUserId } : undefined,
    },
    select: {
      certificateNumber: true,
      user: {
        select: {
          fullName: true,
          username: true,
        },
      },
    },
  });

  if (conflict) {
    const ownerLabel = conflict.user?.fullName || conflict.user?.username || "otro usuario";
    throw new HttpError(
      409,
      `El rango ${formatCertificateSequence(start)} - ${formatCertificateSequence(end)} incluye el certificado ${conflict.certificateNumber} ya emitido por ${ownerLabel}`
    );
  }
};

const assertCertificateRangeRespectsLast = ({ start, end, lastCertificate }) => {
  if (lastCertificate == null) {
    return;
  }

  if (start == null || end == null) {
    throw new HttpError(409, "No se puede quitar el limite de certificados cuando ya existen certificados emitidos");
  }

  if (lastCertificate < start || lastCertificate > end) {
    throw new HttpError(409, "El ultimo certificado emitido queda fuera del nuevo rango");
  }
};

const assertUniqueUserFields = async ({ email, dni, excludeUserId }, db = prisma) => {
  if (email) {
    const existingByEmail = await db.user.findFirst({
      where: {
        email,
        id: excludeUserId ? { not: excludeUserId } : undefined,
      },
      select: { id: true },
    });

    if (existingByEmail) {
      throw new HttpError(409, "El email ya esta en uso");
    }
  }

  if (dni) {
    const existingByDni = await db.user.findFirst({
      where: {
        dni,
        id: excludeUserId ? { not: excludeUserId } : undefined,
      },
      select: { id: true },
    });

    if (existingByDni) {
      throw new HttpError(409, "El dni ya esta en uso");
    }
  }
};

const listUsers = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const { search } = query;

  const where = {
    roleId: query.roleId || undefined,
    isActive: typeof query.isActive === "boolean" ? query.isActive : undefined,
  };

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { dni: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { username: { contains: search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        role: {
          include: withRoleInclude,
        },
      },
      orderBy: { id: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return buildPaginationResult({
    docs: users.map(sanitizeUser),
    total,
    page,
    limit,
  });
};

const getUserById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      role: {
        include: withRoleInclude,
      },
    },
  });
  if (!user) {
    throw new HttpError(404, "Usuario no encontrado");
  }
  return sanitizeUser(user);
};

const assertActorCanManageUser = (actorRole, targetRole) => {
  if (!canManageUserRole(actorRole, targetRole)) {
    throw new HttpError(403, "No tienes permisos para gestionar usuarios de ese grupo");
  }
};

const isLimitOnlyUpdate = (payload = {}) => {
  const keys = Object.keys(payload).filter((key) => payload[key] !== undefined);
  return keys.length > 0 && keys.every((key) => key === "certificateRangeStart" || key === "certificateRangeEnd");
};

const createUser = async ({ username, password, fullName, email, dni, roleId, certificateRangeStart, certificateRangeEnd }, actorRole) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedDni = normalizeDni(dni);
  const requestedRange = normalizeCertificateRangePayload({ certificateRangeStart, certificateRangeEnd });

  return runUserWriteTransaction(async (tx) => {
    const existingUser = await tx.user.findUnique({ where: { username } });
    if (existingUser) {
      throw new HttpError(409, "El nombre de usuario ya existe");
    }

    await assertUniqueUserFields({ email: normalizedEmail, dni: normalizedDni }, tx);

    const hashedPassword = await bcrypt.hash(password, 10);
    const resolvedRole = await resolveRoleForUser({ roleId });
    assertActorCanManageUser(actorRole, resolvedRole.name);

    await assertCertificateRangeAvailability(tx, requestedRange);
    await assertCertificateNumbersAvailability(tx, requestedRange);

    const user = await tx.user.create({
      data: {
        username,
        password: hashedPassword,
        fullName,
        email: normalizedEmail,
        dni: normalizedDni,
        isActive: true,
        roleId: resolvedRole.id,
        certificateRangeStart: requestedRange.start ?? null,
        certificateRangeEnd: requestedRange.end ?? null,
      },
      include: {
        role: {
          include: withRoleInclude,
        },
      },
    });

    return sanitizeUser(user);
  });
};

const updateUser = async (id, payload, actorRole) => {
  const normalizedEmail = payload.email !== undefined ? normalizeEmail(payload.email) : undefined;
  const normalizedDni = payload.dni !== undefined ? normalizeDni(payload.dni) : undefined;
  const requestedRange = normalizeCertificateRangePayload(payload);

  return runUserWriteTransaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { id },
      include: {
        role: {
          include: withRoleInclude,
        },
      },
    });
    if (!existingUser) {
      throw new HttpError(404, "Usuario no encontrado");
    }

    const targetRole = payload.roleId ? await resolveRoleForUser({ roleId: payload.roleId }) : existingUser.role;
    if (isLimitOnlyUpdate(payload)) {
      if (!canManageCertificateLimit(actorRole, targetRole.name)) {
        throw new HttpError(403, "No tienes permisos para gestionar ese limite de certificados");
      }
    } else {
      assertActorCanManageUser(actorRole, targetRole.name);
    }

    const data = {
      fullName: payload.fullName,
      roleId: undefined,
    };

    if (payload.roleId) {
      const resolvedRole = await resolveRoleForUser({ roleId: payload.roleId });
      data.roleId = resolvedRole.id;
    }

    if (payload.email !== undefined && normalizedEmail !== existingUser.email) {
      await assertUniqueUserFields({ email: normalizedEmail, excludeUserId: id }, tx);
      data.email = normalizedEmail;
    }

    if (payload.dni !== undefined && normalizedDni !== existingUser.dni) {
      await assertUniqueUserFields({ dni: normalizedDni, excludeUserId: id }, tx);
      data.dni = normalizedDni;
    }

    if (!payload.fullName) {
      delete data.fullName;
    }

    if (payload.password) {
      data.password = await bcrypt.hash(payload.password, 10);
    }

    if (payload.username && payload.username !== existingUser.username) {
      const duplicate = await tx.user.findUnique({ where: { username: payload.username } });
      if (duplicate) {
        throw new HttpError(409, "El nombre de usuario ya existe");
      }
      data.username = payload.username;
    }

    const nextRangeStart = requestedRange.start !== undefined ? requestedRange.start : existingUser.certificateRangeStart;
    const nextRangeEnd = requestedRange.end !== undefined ? requestedRange.end : existingUser.certificateRangeEnd;

    if (requestedRange.start !== undefined || requestedRange.end !== undefined) {
      const resolvedRange = resolveCertificateRangeBounds({ start: nextRangeStart, end: nextRangeEnd, length: CERTIFICATE_RANGE_DEFAULT_LENGTH });

      if (Number.isNaN(resolvedRange.start) || Number.isNaN(resolvedRange.end)) {
        throw new HttpError(400, "El rango de certificados es invalido");
      }

      assertCertificateRangeRespectsLast({
        start: resolvedRange.start,
        end: resolvedRange.end,
        lastCertificate: existingUser.lastCertificate,
      });

      await assertCertificateRangeAvailability(tx, { ...resolvedRange, excludeUserId: id });
      await assertCertificateNumbersAvailability(tx, { ...resolvedRange, excludeUserId: id });

      data.certificateRangeStart = resolvedRange.start;
      data.certificateRangeEnd = resolvedRange.end;
    }

    const user = await tx.user.update({
      where: { id },
      data,
      include: {
        role: {
          include: withRoleInclude,
        },
      },
    });

    return sanitizeUser(user);
  });
};

const deleteUser = async (id, actorRole) => {
  const existingUser = await prisma.user.findUnique({
    where: { id },
    include: {
      role: {
        include: withRoleInclude,
      },
    },
  });
  if (!existingUser) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  assertActorCanManageUser(actorRole, existingUser.role.name);
  await prisma.user.delete({ where: { id } });
};

const updateUserStatus = async (id, isActive, actorRole) => {
  const existingUser = await prisma.user.findUnique({
    where: { id },
    include: {
      role: {
        include: withRoleInclude,
      },
    },
  });
  if (!existingUser) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  assertActorCanManageUser(actorRole, existingUser.role.name);

  const user = await prisma.user.update({
    where: { id },
    data: { isActive },
    include: {
      role: {
        include: withRoleInclude,
      },
    },
  });

  return sanitizeUser(user);
};

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
};
