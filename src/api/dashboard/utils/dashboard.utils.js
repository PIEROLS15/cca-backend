const STATUS_COLORS = {
  PorFirmar: "oklch(0.6 0.22 25)",
  PorRecoger: "oklch(0.78 0.16 75)",
  Entregado: "oklch(0.65 0.16 155)",
};

const STATUS_LABELS = {
  PorFirmar: "Por firmar",
  PorRecoger: "Por recoger",
  Entregado: "Entregado",
};

const toSummary = ({ certificates, clients, comuneros, terceros, terrainTypes, sectors }) => ({
  certificates,
  clients,
  comuneros,
  terceros,
  terrainTypes,
  sectors,
});

const ALL_STATUSES = ["PorFirmar", "PorRecoger", "Entregado"];

const toStatusBreakdown = (rows) => {
  const map = {};
  for (const r of rows) map[r.status] = r._count;
  return ALL_STATUSES.map((s) => ({
    name: STATUS_LABELS[s],
    value: map[s] || 0,
    color: STATUS_COLORS[s],
  }));
};

const toMonthlyActivity = (data) => data;

module.exports = {
  toSummary,
  toStatusBreakdown,
  toMonthlyActivity,
};
