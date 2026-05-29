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
  clientType: hasOwn(payload, "clientType") ? payload.clientType : currentClient?.clientType,
});

const getNextLicenseSequence = async (tx) => {
  const lastComunero = await tx.client.findFirst({
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

  return (lastComunero?.licenseSequence ?? 0) + 1;
};

const buildClientWriteData = async (tx, payload = {}, currentClient = null) => {
  const data = normalizeClientPayload(payload, currentClient);

  if (data.clientType === "Comunero") {
    return {
      ...data,
      licenseSequence: currentClient?.licenseSequence ?? await getNextLicenseSequence(tx),
    };
  }

  return {
    ...data,
    // Preserve previously assigned licenses for historical traceability.
    licenseSequence: currentClient?.licenseSequence ?? null,
  };
};

const formatClientResponse = (client) => {
  if (!client) {
    return client;
  }

  const { licenseSequence, ...rest } = client;

  return {
    ...rest,
    nro_licence: rest.clientType === "Comunero" ? formatLicenseNumber(licenseSequence) : null,
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
