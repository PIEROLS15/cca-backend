const prisma = require("../../../config/prisma");
const HttpError = require("../../../utils/http-error");
const { formatCommonerLicenseResponse } = require("../../commoner-licenses/utils/commoner-licenses.utils");

const getCommonerLicenseVerificationByLicenseNumber = async (licenseNumber) => {
  const normalized = String(licenseNumber || "").trim();

  if (!normalized) {
    throw new HttpError(400, "El numero de carnet es obligatorio");
  }

  const license = await prisma.commonerLicense.findUnique({
    where: { licenseNumber: normalized },
  });

  if (!license) {
    throw new HttpError(404, "Carnet de comunero no encontrado");
  }

  return formatCommonerLicenseResponse(license);
};

module.exports = {
  getCommonerLicenseVerificationByLicenseNumber,
};
