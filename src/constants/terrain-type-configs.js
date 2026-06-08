const TERRAIN_MEASUREMENT_MODES = {
  RECTANGULAR_AUTO: "RECTANGULAR_AUTO",
  AREA_PERIMETER: "AREA_PERIMETER",
  MANUAL_TOTAL_AREA: "MANUAL_TOTAL_AREA",
};

const TERRAIN_TYPE_CONFIG_DEFINITIONS = [
  {
    key: "RECTANGULAR_STANDARD",
    label: "Rectangular estándar",
    formMode: TERRAIN_MEASUREMENT_MODES.RECTANGULAR_AUTO,
    showMzLot: true,
    allowAdditionalMeasure: false,
    allowAreaPerimeterToggle: false,
  },
  {
    key: "AREA_PERIMETER_SECTOR_ONLY",
    label: "Área y perímetro solo sector",
    formMode: TERRAIN_MEASUREMENT_MODES.AREA_PERIMETER,
    showMzLot: false,
    allowAdditionalMeasure: false,
    allowAreaPerimeterToggle: false,
  },
  {
    key: "RECTANGULAR_WITH_OPTIONS",
    label: "Rectangular con opciones",
    formMode: TERRAIN_MEASUREMENT_MODES.RECTANGULAR_AUTO,
    showMzLot: true,
    allowAdditionalMeasure: true,
    allowAreaPerimeterToggle: true,
  },
  {
    key: "MANUAL_TOTAL_AREA",
    label: "Área total manual",
    formMode: TERRAIN_MEASUREMENT_MODES.MANUAL_TOTAL_AREA,
    showMzLot: true,
    allowAdditionalMeasure: false,
    allowAreaPerimeterToggle: false,
  },
];

const DEFAULT_TERRAIN_TYPE_CONFIG_KEY = "RECTANGULAR_STANDARD";

const TERRAIN_TYPE_CONFIG_BY_NAME = {
  ERIAZO: "AREA_PERIMETER_SECTOR_ONLY",
  CULTIVO: "AREA_PERIMETER_SECTOR_ONLY",
  DESCAMPADO: "RECTANGULAR_STANDARD",
  VIVIENDA: "RECTANGULAR_WITH_OPTIONS",
  AGRICOLA: "RECTANGULAR_WITH_OPTIONS",
  "CASA HUERTA": "AREA_PERIMETER_SECTOR_ONLY",
  "USO DEPORTIVO": "RECTANGULAR_STANDARD",
  RECREACIONAL: "MANUAL_TOTAL_AREA",
  EDUCACIONAL: "RECTANGULAR_STANDARD",
  MERCADO: "RECTANGULAR_STANDARD",
  E: "RECTANGULAR_STANDARD",
  PLAYA: "AREA_PERIMETER_SECTOR_ONLY",
  "INSTITUCIONAL DE USO COMUN": "RECTANGULAR_STANDARD",
  "INSTITUCIONAL DE USO COMÚN": "RECTANGULAR_STANDARD",
};

const normalizeTerrainTypeKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const resolveTerrainTypeConfigKey = (terrainTypeName) =>
  TERRAIN_TYPE_CONFIG_BY_NAME[normalizeTerrainTypeKey(terrainTypeName)] || DEFAULT_TERRAIN_TYPE_CONFIG_KEY;

module.exports = {
  TERRAIN_MEASUREMENT_MODES,
  TERRAIN_TYPE_CONFIG_DEFINITIONS,
  DEFAULT_TERRAIN_TYPE_CONFIG_KEY,
  resolveTerrainTypeConfigKey,
  normalizeTerrainTypeKey,
};
