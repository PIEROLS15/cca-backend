const LICENSE_NUMBER_LENGTH = 4;

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

const formatLicenseNumber = (licenseSequence) => {
  if (licenseSequence == null) {
    return null;
  }

  return String(licenseSequence).padStart(LICENSE_NUMBER_LENGTH, "0");
};

const normalizeClientPayload = (payload = {}, currentClient = null) => ({
  fullName: hasOwn(payload, "fullName") ? normalizeString(payload.fullName) : currentClient?.fullName,
  documentNumber: hasOwn(payload, "documentNumber") ? normalizeString(payload.documentNumber) : currentClient?.documentNumber,
  address: hasOwn(payload, "address") ? normalizeOptionalString(payload.address) : currentClient?.address ?? null,
  phone: hasOwn(payload, "phone") ? normalizeOptionalString(payload.phone) : currentClient?.phone ?? null,
  isComunero: hasOwn(payload, "isComunero") ? Boolean(payload.isComunero) : currentClient?.commoner != null,
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

const buildClientWriteData = async (tx, payload = {}, currentClient = null) => {
  const data = normalizeClientPayload(payload, currentClient);
  const { isComunero, ...clientData } = data;

  const wantsComunero = isComunero;
  const isCurrentlyComunero = currentClient?.commoner != null;

  if (wantsComunero && !isCurrentlyComunero) {
    clientData.commoner = {
      create: { licenseSequence: await getNextLicenseSequence(tx) },
    };
  } else if (wantsComunero && isCurrentlyComunero) {
    if (currentClient.commoner.licenseSequence == null) {
      clientData.commoner = {
        update: { licenseSequence: await getNextLicenseSequence(tx) },
      };
    }
  } else if (!wantsComunero && isCurrentlyComunero) {
    clientData.commoner = {
      update: { licenseSequence: null },
    };
  }

  return clientData;
};

const formatClientResponse = (client) => {
  if (!client) {
    return client;
  }

  const { commoner, ...rest } = client;

  return {
    ...rest,
    clientType: commoner ? "Comunero" : "Tercero",
    nro_licence: commoner?.licenseSequence != null ? formatLicenseNumber(commoner.licenseSequence) : null,
    licenseSequence: commoner?.licenseSequence ?? null,
  };
};

const formatClientCollection = (clients = []) => clients.map(formatClientResponse);

module.exports = {
  buildClientWriteData,
  formatClientCollection,
  formatClientResponse,
  formatLicenseNumber,
  getNextLicenseSequence,
  normalizeClientPayload,
};
