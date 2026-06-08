const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const c = await p.certificate.count();
  console.log("Certificados en DB:", c);
  const s = await p.certificate.findMany({ orderBy: { certificateNumber: "desc" }, take: 5, select: { certificateNumber: true, createdAt: true } });
  console.log("Ultimos 5:", JSON.stringify(s, null, 2));
  await p.$disconnect();
})();
