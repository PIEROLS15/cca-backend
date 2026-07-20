const request = require("supertest");
const app = require("../../../src/app");
const prisma = require("../../../src/config/prisma");
const { buildCertificateRequestPdf } = require("../../../src/api/certificate-requests/utils/certificate-requests-pdf.utils");
const {
  getAuthUser,
  makeAuthToken,
  createCertificateRequestFixture,
  removeCertificateRequestFixture,
} = require("../certificate-requests.test-utils");
const uniqueDocNumber = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const getBinary = (res, cb) => {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
  res.on("error", cb);
};

describe("certificate-requests controller", () => {
  let authUser;
  let token;
  let fixture;
  const created = [];

  beforeAll(async () => {
    authUser = await getAuthUser();
    token = makeAuthToken(authUser);
  });

  beforeEach(async () => {
    fixture = await createCertificateRequestFixture({
      requestNumber: `IT-CR-CTRL-${Date.now()}`,
      destination: "Secretaria",
      certificateTypes: [{ type: "CertificadoPosesion" }],
      attachments: [{ type: "CopiaDni" }, { type: "Celular", phoneNumber: "999999999" }],
    });
  });

  afterEach(async () => {
    for (const item of created.splice(0)) {
      await removeCertificateRequestFixture(item);
    }

    await removeCertificateRequestFixture(fixture);
  });

  const authHeader = () => ({ Authorization: `Bearer ${token}` });

  it("lists requests using the real DB", async () => {
    const res = await request(app)
      .get("/api/certificate-requests")
      .query({ search: fixture.request.requestNumber })
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.error).toBe(false);
    expect(res.body.data.some((item) => item.requestNumber === fixture.request.requestNumber)).toBe(true);
  });

  it("gets a request by id", async () => {
    const res = await request(app)
      .get(`/api/certificate-requests/${fixture.request.id}`)
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(fixture.request.id);
    expect(res.body.requestNumber).toBe(fixture.request.requestNumber);
  });

  it("rejects create when client fields are missing", async () => {
    const res = await request(app)
      .post("/api/certificate-requests")
      .set(authHeader())
      .send({ client: { documentNumber: fixture.client.documentNumber } });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("client.fullName y client.documentNumber son obligatorios");
  });

  it("creates a request in the real DB", async () => {
    const res = await request(app)
      .post("/api/certificate-requests")
      .set(authHeader())
      .send({
        client: {
          fullName: fixture.client.fullName,
          documentNumber: fixture.client.documentNumber,
        },
        destination: "Secretaria",
        requestDescription: "Solicitud creada desde controller",
        sectorLocation: "Sector prueba",
        certificateTypes: [{ type: "CertificadoPosesion" }],
        attachments: [{ type: "CopiaDni" }],
        isComunero: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.requestNumber).toMatch(/^\d{6}-\d{2}$/);

    created.push({
      request: {
        id: res.body.id,
        clientId: res.body.client.id,
        partnerId: res.body.partnerClient?.id || null,
      },
      client: { id: res.body.client.id },
      partner: res.body.partnerClient?.id ? { id: res.body.partnerClient.id } : null,
    });
  });

  it("updates a request", async () => {
    const res = await request(app)
      .put(`/api/certificate-requests/${fixture.request.id}`)
      .set(authHeader())
      .send({ status: "Observado", note: "Falta firma" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Observado");
    expect(res.body.statusNote).toBe("Falta firma");
  });

  it("rejects missing note when marking Observado", async () => {
    const res = await request(app)
      .put(`/api/certificate-requests/${fixture.request.id}`)
      .set(authHeader())
      .send({ status: "Observado" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("La razón es obligatoria cuando el estado es Observado");
  });

  it("deletes a request", async () => {
    const temp = await createCertificateRequestFixture({
      requestNumber: `IT-CR-DEL-CTRL-${Date.now()}`,
      destination: "Secretaria",
      certificateTypes: [{ type: "CertificadoPosesion" }],
      attachments: [{ type: "CopiaDni" }],
    });

    const res = await request(app)
      .delete(`/api/certificate-requests/${temp.request.id}`)
      .set(authHeader());

    expect(res.status).toBe(204);
    const found = await prisma.certificateRequest.findUnique({ where: { id: temp.request.id } });
    expect(found).toBeNull();

    await removeCertificateRequestFixture(temp);
  });

  it("builds a delete preview", async () => {
    const res = await request(app)
      .get(`/api/certificate-requests/${fixture.request.id}/delete-preview`)
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.itemName).toBe(fixture.request.requestNumber);
    expect(res.body.canDelete).toBe(true);
  });

  it("downloads a request pdf", async () => {
    const filename = `solicitud-certificado-${fixture.request.requestNumber}.pdf`;
    const res = await request(app)
      .get(`/api/certificate-requests/download/${filename}`)
      .set(authHeader())
      .buffer(true)
      .parse(getBinary);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain(filename);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
