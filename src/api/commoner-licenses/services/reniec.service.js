const HttpError = require("../../../utils/http-error");

const titleCase = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/\b\w/g, (char) => char.toUpperCase());

const getReniecConfig = () => {
  const provider = String(process.env.RENIEC_PROVIDER || "codart").toLowerCase();

  if (provider === "codart") {
    return {
      provider,
      token: process.env.RENIEC_CODART_TOKEN || process.env.RENIEC_TOKEN,
      baseUrl: process.env.RENIEC_CODART_URL || process.env.API_RENIEC_DNI,
    };
  }

  if (provider === "decolecta") {
    return {
      provider,
      token: process.env.RENIEC_DECOLECTA_TOKEN,
      baseUrl: process.env.RENIEC_DECOLECTA_URL,
    };
  }

  throw new HttpError(500, "Proveedor RENIEC no soportado");
};

const normalizeAddress = (value) => {
  const address = String(value || "").trim();
  return address.toLowerCase() === "data in credit" ? "" : address;
};

const extractResponse = (data, documentNumber) => {
  const result = data?.data ?? data?.result ?? data ?? {};
  const imageDataUri = result?.images?.[0]?.data_uri || result?.photo?.data_uri || result?.foto?.data_uri || null;
  const firstNames = String(result?.nombres || result?.first_name || "").trim();
  const lastNames = String(result?.apellidos || [result?.first_last_name, result?.second_last_name].filter(Boolean).join(" ") || "").trim();
  const fullName = String(result?.full_name || [firstNames, lastNames].filter(Boolean).join(" ") || "").trim();

  return {
    dni: String(result?.dni?.numero || result?.document_number || documentNumber || "").trim(),
    firstNames,
    lastNames,
    fullName: titleCase(fullName),
    gender: String(result?.genero || result?.gender || "").trim().toUpperCase(),
    birthDate: String(result?.nacimiento?.fecha || result?.birth_date || result?.date_of_birth || "").trim(),
    address: normalizeAddress(result?.domicilio?.direccion || result?.address),
    photoDataUri: imageDataUri,
    raw: result,
  };
};

const searchDetailedByDocument = async (documentNumber) => {
  const { token, baseUrl } = getReniecConfig();

  if (!token || !baseUrl) {
    throw new HttpError(500, "RENIEC no configurado");
  }

  const response = await fetch(`${baseUrl}${documentNumber}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new HttpError(404, "No se encontraron datos para el DNI ingresado");
    }

    throw new HttpError(502, "Error al consultar RENIEC");
  }

  const data = await response.json();

  if (data?.success === false) {
    throw new HttpError(404, data?.message || "No se encontraron datos para el DNI ingresado");
  }

  return extractResponse(data, documentNumber);
};

module.exports = {
  searchDetailedByDocument,
};
