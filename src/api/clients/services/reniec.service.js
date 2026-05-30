const HttpError = require("../../../utils/http-error");

const searchByDocument = async (documentNumber) => {
  const token = process.env.RENIEC_TOKEN;
  const baseUrl = process.env.API_RENIEC_DNI;

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

  const fullName = [data.first_name, data.first_last_name, data.second_last_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    fullName: fullName || data.full_name || "",
    documentNumber: data.document_number || documentNumber,
    address: "",
  };
};

module.exports = { searchByDocument };
