const {
  TERRAIN_MEASUREMENT_MODES,
} = require("../../src/constants/terrain-type-configs");

function parseDecimal(raw) {
  const value = String(raw || "").trim();
  if (!value || value.toLowerCase() === "nan" || value.toUpperCase() === "S/N") return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function resolveMeasurementMode(rawDoc) {
  const width = parseDecimal(rawDoc.anchoArea);
  const length = parseDecimal(rawDoc.largoArea);
  const totalArea = parseDecimal(rawDoc.totalArea);
  const area = parseDecimal(rawDoc.areaCultivo);
  const perimeter = parseDecimal(rawDoc.perimetroCultivo);

  if (area !== null || perimeter !== null) {
    return TERRAIN_MEASUREMENT_MODES.AREA_PERIMETER;
  }

  if (width === null && length === null && totalArea !== null) {
    return TERRAIN_MEASUREMENT_MODES.MANUAL_TOTAL_AREA;
  }

  return TERRAIN_MEASUREMENT_MODES.RECTANGULAR_AUTO;
}

function mapRemoteCertificateMeasurements(rawDoc) {
  return {
    width: parseDecimal(rawDoc.anchoArea),
    length: parseDecimal(rawDoc.largoArea),
    totalArea: parseDecimal(rawDoc.totalArea),
    area: parseDecimal(rawDoc.areaCultivo),
    perimeter: parseDecimal(rawDoc.perimetroCultivo),
    additionalWidth: parseDecimal(rawDoc.newAnchoArea),
    additionalLength: parseDecimal(rawDoc.newLargoArea),
    measurementModeUsed: resolveMeasurementMode(rawDoc),
  };
}

module.exports = {
  parseDecimal,
  mapRemoteCertificateMeasurements,
};
