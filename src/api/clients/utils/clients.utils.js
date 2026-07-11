const HttpError = require("../../../utils/http-error");
const { getRoleGroup } = require("../../../utils/access-control.utils");

const LICENSE_NUMBER_LENGTH = 4;
const CLIENT_CODE_PREFIX = "CLI-";
const CLIENT_CODE_PADDING = 3;

const normalizeString = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return String(value).trim();
};

const normalizeOptionalString = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return String(value).trim() || null;
};

const hasOwn = (payload, key) => Object.prototype.hasOwnProperty.call(payload, key);

const isGroupOneRole = (roleName) => getRoleGroup(roleName) === 1;

const formatLicenseNumber = (licenseSequence) => {
  if (licenseSequence == null) {
    return null;
  }

  return String(licenseSequence).padStart(LICENSE_NUMBER_LENGTH, "0");
};

const formatClientCode = (sequence) => {
  if (sequence == null) {
    return null;
  }

  return `${CLIENT_CODE_PREFIX}${String(sequence).padStart(CLIENT_CODE_PADDING, "0")}`;
};

const parseClientCodeNumber = (clientCode) => {
  const match = String(clientCode || "").trim().match(/^CLI-(\d+)$/i);
  return match ? Number(match[1]) : null;
};

const getNextClientCodeSequence = async (tx) => {
  const clients = await tx.client.findMany({
    where: { clientCode: { not: null } },
    select: { clientCode: true },
  });

  return clients.reduce((max, client) => {
    const parsed = parseClientCodeNumber(client.clientCode);
    return parsed != null && parsed > max ? parsed : max;
  }, 0) + 1;
};

const normalizeLicenseSequenceInput = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, "licenseSequence debe ser un numero entero positivo");
  }

  return parsed;
};

const normalizeClientPayload = (payload = {}, currentClient = null) => ({
  fullName: hasOwn(payload, "fullName") ? normalizeString(payload.fullName) : currentClient?.fullName,
  documentNumber: hasOwn(payload, "documentNumber") ? normalizeOptionalString(payload.documentNumber) : currentClient?.documentNumber ?? null,
  address: hasOwn(payload, "address") ? normalizeOptionalString(payload.address) : currentClient?.address ?? null,
  phone: hasOwn(payload, "phone") ? normalizeOptionalString(payload.phone) : currentClient?.phone ?? null,
  isComunero: hasOwn(payload, "isComunero") ? Boolean(payload.isComunero) : currentClient?.commoner != null,
  noDocument: hasOwn(payload, "noDocument")
    ? Boolean(payload.noDocument)
    : currentClient?.documentNumber == null,
  licenseSequence: hasOwn(payload, "licenseSequence") ? normalizeLicenseSequenceInput(payload.licenseSequence) : undefined,
});

const getNextLicenseSequence = async (tx) => {
  const lastProfile = await tx.commoner.findFirst({
    where: {
      licenseSequence: {
        not: null,
      },
    },
    orderBy: {
      licenseSequence: "desc",
    },
    select: {
      licenseSequence: true,
    },
  });

  return (lastProfile?.licenseSequence ?? 0) + 1;
};

const resolveCommonerWrite = async (tx, clientData, data, currentClient, actorRoleName) => {
  const wantsComunero = data.isComunero;
  const currentCommoner = currentClient?.commoner ?? null;
  const currentSeq = currentCommoner?.licenseSequence ?? null;
  const currentIsActive = currentCommoner?.isActive ?? false;
  const requestedSequence = data.licenseSequence;
  const canEditSequence = isGroupOneRole(actorRoleName);

  delete clientData.isComunero;
  delete clientData.licenseSequence;

  if (wantsComunero && !currentCommoner) {
    let licenseSequence = await getNextLicenseSequence(tx);

    if (requestedSequence !== undefined) {
      if (!canEditSequence) {
        throw new HttpError(403, "No tiene permiso para editar el numero de carnet");
      }
      if (requestedSequence !== licenseSequence) {
        throw new HttpError(400, "El numero de carnet debe ser el siguiente consecutivo disponible");
      }
      licenseSequence = requestedSequence;
    }

    clientData.commoner = {
      create: {
        licenseSequence,
        isActive: true,
      },
    };

    return clientData;
  }

  if (!wantsComunero && currentCommoner) {
    clientData.commoner = {
      update: {
        isActive: false,
      },
    };
    return clientData;
  }

  if (wantsComunero && currentCommoner) {
    const commonerUpdate = { isActive: true };

    if (currentSeq == null) {
      let licenseSequence = await getNextLicenseSequence(tx);

      if (requestedSequence !== undefined) {
        if (!canEditSequence) {
          throw new HttpError(403, "No tiene permiso para editar el numero de carnet");
        }
        if (requestedSequence !== licenseSequence) {
          throw new HttpError(400, "El numero de carnet debe ser el siguiente consecutivo disponible");
        }
        licenseSequence = requestedSequence;
      }

      commonerUpdate.licenseSequence = licenseSequence;
    } else if (requestedSequence !== undefined && requestedSequence !== currentSeq) {
      if (!canEditSequence) {
        throw new HttpError(403, "No tiene permiso para editar el numero de carnet");
      }
      throw new HttpError(400, "El numero de carnet ya esta asignado y no puede cambiarse");
    }

    if (!currentIsActive || Object.prototype.hasOwnProperty.call(commonerUpdate, "licenseSequence")) {
      clientData.commoner = {
        update: commonerUpdate,
      };
    }
  }

  return clientData;
};

const buildClientWriteData = async (tx, payload = {}, currentClient = null) => {
  const data = normalizeClientPayload(payload, currentClient);
  const { isComunero, noDocument, licenseSequence, ...clientData } = data;

  clientData.isComunero = isComunero;
  if (licenseSequence !== undefined) {
    clientData.licenseSequence = licenseSequence;
  }

  if (noDocument) {
    clientData.documentNumber = null;
    clientData.clientCode = currentClient?.clientCode ?? formatClientCode(await getNextClientCodeSequence(tx));
  } else {
    clientData.clientCode = currentClient?.clientCode ?? null;
  }

  await resolveCommonerWrite(tx, clientData, data, currentClient, payload.actorRoleName || null);

  return clientData;
};

const formatClientResponse = (client) => {
  if (!client) {
    return client;
  }

  const { commoner, ...rest } = client;

  return {
    ...rest,
    clientType: commoner?.isActive ? "Comunero" : "Tercero",
    nro_licence: commoner?.licenseSequence != null ? formatLicenseNumber(commoner.licenseSequence) : null,
    licenseSequence: commoner?.licenseSequence ?? null,
    clientCode: rest.clientCode ?? null,
  };
};

const formatClientCollection = (clients = []) => clients.map(formatClientResponse);

module.exports = {
  buildClientWriteData,
  formatClientCollection,
  formatClientResponse,
  formatLicenseNumber,
  formatClientCode,
  getNextClientCodeSequence,
  getNextLicenseSequence,
  normalizeClientPayload,
  normalizeLicenseSequenceInput,
};
