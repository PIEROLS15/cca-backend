const request = require("supertest");
const app = require("../../../src/app");
const prisma = require("../../../src/config/prisma");

describe("public routes", () => {
  let certificate;

  beforeAll(async () => {
    certificate = await prisma.certificate.findFirst({ orderBy: { id: "asc" } });
    if (!certificate) {
      throw new Error("No se encontró un certificado base en la DB de test");
    }
  });

  it("verifies certificate without auth", async () => {
    const res = await request(app).get(`/api/public/certificates/${certificate.verificationToken}`);
    expect(res.status).toBe(200);
  });

  it("tracks document without auth", async () => {
    const res = await request(app).get(`/api/public/tracking/solicitudcertificado/${certificate.requestNumber}`);
    expect([200, 404]).toContain(res.status);
  });
});
