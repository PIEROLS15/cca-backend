const HttpError = require("../../../utils/http-error");

const titleCase = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeAddress = (value) => {
  const address = String(value || "").trim();
  return address.toLowerCase() === "data in credit" ? "" : address;
};

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

const searchByDocument = async (documentNumber) => {
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

  const result = data?.result ?? data;

  const fullName = [result.first_name, result.first_last_name, result.second_last_name]
    .filter(Boolean)
    .join(" ")
    || result.full_name
    || "";

  return {
    fullName: titleCase(fullName),
    documentNumber: result.document_number || documentNumber,
    address: normalizeAddress(result.address),
  };
};

module.exports = { searchByDocument };
