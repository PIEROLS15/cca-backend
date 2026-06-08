const normalizeName = (name) => name.trim().replace(/\s+/g, " ");

const formatTerrainTypeConfig = (config) => {
  if (!config) return null;

  return {
    id: config.id,
    key: config.key,
    label: config.label,
    formMode: config.formMode,
    showMzLot: config.showMzLot,
    allowAdditionalMeasure: config.allowAdditionalMeasure,
    allowAreaPerimeterToggle: config.allowAreaPerimeterToggle,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
};

const formatTerrainTypeResponse = (terrainType) => ({
  id: terrainType.id,
  name: terrainType.name,
  terrainTypeConfigId: terrainType.terrainTypeConfigId,
  config: formatTerrainTypeConfig(terrainType.config),
  createdAt: terrainType.createdAt,
  updatedAt: terrainType.updatedAt,
});

module.exports = {
  normalizeName,
  formatTerrainTypeConfig,
  formatTerrainTypeResponse,
};
