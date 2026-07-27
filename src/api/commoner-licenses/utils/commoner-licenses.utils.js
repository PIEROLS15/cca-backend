const HttpError = require("../../../utils/http-error");

const normalizeSearchTerm = (value) => String(value || "").trim();

const parseBirthDate = (value) => {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    throw new HttpError(502, "La fecha de nacimiento no tiene un formato valido");
  }

  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const formatCommonerLicenseResponse = (license) => {
  if (!license) return license;

  return {
    ...license,
    hasPhoto: Boolean(license.photoPath),
    photoUrl: license.photoPath,
  };
};

const formatCommonerLicenseCollection = (records = []) => records.map(formatCommonerLicenseResponse);

module.exports = {
  normalizeSearchTerm,
  parseBirthDate,
  formatCommonerLicenseResponse,
  formatCommonerLicenseCollection,
};
