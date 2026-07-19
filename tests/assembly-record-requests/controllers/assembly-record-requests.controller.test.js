const request = require("supertest");
const app = require("../../../src/app");
const prisma = require("../../../src/config/prisma");
const {
  makeAuthToken,
  createAssemblyRecordRequestFixture,
  removeAssemblyRecordRequestFixture,
  getBaseContext,
} = require("../assembly-record-requests.test-utils");

const getBinary = (res, cb) => {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
  res.on("error", cb);
};

describe("assembly-record-requests controller", () => {
  let token;
  let baseContext;
  let fixture;
  const createdIds = [];

  beforeAll(async () => {
    baseContext = await getBaseContext();
    token = makeAuthToken({ sub: baseContext.user.id });
  });

  beforeEach(async () => {
    fixture = await createAssemblyRecordRequestFixture({
      description: `Controller fixture ${Date.now()}`,
      attachments: [{ type: "CertPosesion" }, { type: "PlanoMemoria" }],
      legacyPayload: { typeUser: "comunero" },
    });
  });

  afterEach(async () => {
    for (const id of createdIds.splice(0)) {
      await removeAssemblyRecordRequestFixture(id);
    }

    await removeAssemblyRecordRequestFixture(fixture?.id);
  });

  const authHeader = () => ({ Authorization: `Bearer ${token}` });

  it("lists requests using the real DB", async () => {
    const res = await request(app)
      .get("/api/assembly-record-requests")
      .query({ search: fixture.description })
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.error).toBe(false);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((item) => item.code === fixture.code)).toBe(true);
  });

  it("gets a request by id", async () => {
    const res = await request(app)
      .get(`/api/assembly-record-requests/${fixture.id}`)
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(fixture.code);
    expect(res.body._id).toBe(fixture.code);
  });

  it("rejects create when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/assembly-record-requests")
      .set(authHeader())
      .send({ clientId: fixture.clientId });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("clientId y certificateId son obligatorios");
  });

  it("creates a request in the real DB", async () => {
    const res = await request(app)
      .post("/api/assembly-record-requests")
      .set(authHeader())
      .send({
        clientId: fixture.clientId,
        certificateId: fixture.certificateId,
        description: `Created from controller ${Date.now()}`,
        buyerFullName: fixture.client.fullName,
        sellerFullName: "Vendedor de prueba",
        sectorLocation: fixture.certificate.sector.name,
        terrainType: fixture.certificate.terrainType.name,
        attachments: [{ type: "CertPosesion" }],
      });

    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^SOL-ACTA-/);

    createdIds.push(res.body.id);
  });

  it("updates a request", async () => {
    const res = await request(app)
      .put(`/api/assembly-record-requests/${fixture.id}`)
      .set(authHeader())
      .send({ status: "PorRecoger", description: `Updated ${Date.now()}` });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Por Recoger");
    expect(res.body.code).toBe(fixture.code);
  });

  it("deletes a request", async () => {
    const temp = await createAssemblyRecordRequestFixture({
      description: `Delete controller fixture ${Date.now()}`,
      attachments: [{ type: "CertPosesion" }],
      legacyPayload: { typeUser: "comunero" },
    });

    const res = await request(app)
      .delete(`/api/assembly-record-requests/${temp.id}`)
      .set(authHeader());

    expect(res.status).toBe(204);

    const found = await prisma.assemblyRecordRequest.findUnique({ where: { id: temp.id } });
    expect(found).toBeNull();
  });

  it("builds a preview", async () => {
    const res = await request(app)
      .get(`/api/assembly-record-requests/${fixture.id}/preview`)
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.preview).toContain(fixture.code);
    expect(res.body.client).toBe(fixture.client.fullName);
  });

  it("builds a delete preview", async () => {
    const res = await request(app)
      .get(`/api/assembly-record-requests/${fixture.id}/delete-preview`)
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.canDelete).toBe(true);
    expect(res.body.itemName).toBe(fixture.code);
  });

  it("downloads a request pdf", async () => {
    const res = await request(app)
      .get(`/api/assembly-record-requests/${fixture.id}/pdf`)
      .set(authHeader())
      .buffer(true)
      .parse(getBinary);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain(`solicitud-acta-${fixture.code}.pdf`);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("downloads a request pdf by filename", async () => {
    const filename = `solicitud-acta-${fixture.code}.pdf`;
    const res = await request(app)
      .get(`/api/assembly-record-requests/download/${filename}`)
      .set(authHeader())
      .buffer(true)
      .parse(getBinary);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain(filename);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
