const request = require("supertest");
const app = require("../../../src/app");
const prisma = require("../../../src/config/prisma");

describe("public routes", () => {
  let certificate;
  let commonerLicense;

  beforeAll(async () => {
    certificate = await prisma.certificate.findFirst({ orderBy: { id: "asc" } });
    if (!certificate) {
      throw new Error("No se encontró un certificado base en la DB de test");
    }

    commonerLicense = await prisma.commonerLicense.upsert({
      where: { licenseNumber: "4780" },
      update: {
        fullName: "ANA LUCIA HUAMAN CASTRO",
        firstNames: "ANA LUCIA",
        lastNames: "HUAMAN CASTRO",
        gender: "FEMENINO",
        birthDate: new Date("2003-04-15T00:00:00.000Z"),
        address: "ANEXO SAN JUAN MZ.A-10 LT.2 LOS GIRASOLES I ETAPA",
        photoPath: "/uploads/commoners/test.png",
      },
      create: {
        dni: "73171545",
        licenseNumber: "4780",
        fullName: "ANA LUCIA HUAMAN CASTRO",
        firstNames: "ANA LUCIA",
        lastNames: "HUAMAN CASTRO",
        gender: "FEMENINO",
        birthDate: new Date("2003-04-15T00:00:00.000Z"),
        address: "ANEXO SAN JUAN MZ.A-10 LT.2 LOS GIRASOLES I ETAPA",
        photoPath: "/uploads/commoners/test.png",
      },
    });
  });

  it("verifies certificate without auth", async () => {
    const res = await request(app).get(`/api/public/certificates/${certificate.verificationToken}`);
    expect(res.status).toBe(200);
  });

  it("verifies commoner license without auth", async () => {
    const res = await request(app).get(`/api/public/commoner-licenses/${commonerLicense.licenseNumber}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      dni: "73171545",
      licenseNumber: "4780",
      hasPhoto: true,
    });
  });

  it("tracks document without auth", async () => {
    const res = await request(app).get(`/api/public/tracking/solicitudcertificado/${certificate.requestNumber}`);
    expect([200, 404]).toContain(res.status);
  });
});
