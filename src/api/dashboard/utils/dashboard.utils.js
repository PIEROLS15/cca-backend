const STATUS_COLORS = {
  Recepcionado: "oklch(0.72 0.14 235)",
  PorFirmar: "oklch(0.6 0.22 25)",
  PorRecoger: "oklch(0.78 0.16 75)",
  Entregado: "oklch(0.65 0.16 155)",
  Observado: "oklch(0.62 0.24 25)",
};

const STATUS_LABELS = {
  Recepcionado: "Recepcionado",
  PorFirmar: "Por firmar",
  PorRecoger: "Por recoger",
  Entregado: "Entregado",
  Observado: "Observado",
};

const toSummary = ({ certificates, clients, comuneros, terceros, terrainTypes, sectors }) => ({
  certificates,
  clients,
  comuneros,
  terceros,
  terrainTypes,
  sectors,
});

const ALL_STATUSES = ["Recepcionado", "PorFirmar", "PorRecoger", "Entregado", "Observado"];

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
