const prisma = require("../../../config/prisma");
const { toSummary, toStatusBreakdown, toMonthlyActivity, TO_MONTH } = require("../utils/dashboard.utils");

const MONTHS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const getSummary = async () => {
  const [certificates, clients, terrainTypes, sectors] = await Promise.all([
    prisma.certificate.count(),
    prisma.client.count(),
    prisma.terrainType.count(),
    prisma.sector.count(),
  ]);

  return toSummary({ certificates, clients, terrainTypes, sectors });
};

const getStatusBreakdown = async ({ from, to } = {}) => {
  const where = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }
  const rows = await prisma.certificate.groupBy({
    by: ["status"],
    _count: true,
    where,
  });

  return toStatusBreakdown(rows);
};

const getMonthlyActivity = async ({ from, to } = {}) => {
  const dateFilter = {};
  if (from || to) {
    dateFilter.createdAt = {};
    if (from) dateFilter.createdAt.gte = from;
    if (to) dateFilter.createdAt.lte = to;
  }
  const [certificates, certificateRequests, assemblyRequests] = await Promise.all([
    prisma.certificate.findMany({ select: { createdAt: true }, where: dateFilter }),
    prisma.certificateRequest.findMany({ select: { createdAt: true }, where: dateFilter }),
    prisma.assemblyRecordRequest.findMany({ select: { createdAt: true }, where: dateFilter }),
  ]);

  const bucket = (items, label) => {
    const map = {};
    for (const m of MONTHS) map[m] = 0;
    for (const { createdAt } of items) {
      const d = new Date(createdAt);
      const key = MONTHS[d.getMonth()];
      if (key) map[key]++;
    }
    return MONTHS.map((mes) => ({ mes, [label]: map[mes] }));
  };

  const cert = bucket(certificates, "certificados");
  const req = bucket(certificateRequests, "solicitudesCert");
  const act = bucket(assemblyRequests, "solicitudesActa");

  return cert.map((c, i) => ({
    ...c,
    ...req[i],
    ...act[i],
  }));
};

const getRecentActivity = async () => {
  const limit = 5;

  const [certificates, certRequests, assemblyRequests] = await Promise.all([
    prisma.certificate.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { fullName: true } },
        client: { select: { fullName: true } },
      },
    }),
    prisma.certificateRequest.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { fullName: true } },
        client: { select: { fullName: true } },
      },
    }),
    prisma.assemblyRecordRequest.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { fullName: true } },
        client: { select: { fullName: true } },
      },
    }),
  ]);

  const mapped = [
    ...certificates.map((c) => ({
      id: `cert-${c.id}`,
      usuario: c.user?.fullName ?? "Sistema",
      accion: `generó el certificado ${c.certificateNumber} para ${c.client.fullName}`,
      cuando: c.createdAt,
    })),
    ...certRequests.map((r) => ({
      id: `creq-${r.id}`,
      usuario: r.user?.fullName ?? "Sistema",
      accion: `registró la solicitud ${r.requestNumber} para ${r.client.fullName}`,
      cuando: r.createdAt,
    })),
    ...assemblyRequests.map((a) => ({
      id: `areq-${a.id}`,
      usuario: a.user?.fullName ?? "Sistema",
      accion: `solicitó acta de asamblea para ${a.client.fullName}`,
      cuando: a.createdAt,
    })),
  ];

  mapped.sort((a, b) => new Date(b.cuando).getTime() - new Date(a.cuando).getTime());

  return mapped.slice(0, limit);
};

module.exports = {
  getSummary,
  getStatusBreakdown,
  getMonthlyActivity,
  getRecentActivity,
};
