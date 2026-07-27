const request = require("supertest");

const commonerLicensesController = require("../../../src/api/commoner-licenses/controllers/commoner-licenses.controller");
Object.assign(commonerLicensesController, {
  listCommonerLicenses: vi.fn((req, res) => res.status(200).json({ message: "ok", error: false, status: 200, data: [] })),
  searchCommonerLicenses: vi.fn((req, res) => res.status(200).json({ message: "ok", error: false, status: 200, data: [] })),
  createCommonerLicense: vi.fn((req, res) => res.status(201).json({ id: 1, dni: req.body.dni, licenseNumber: req.body.numeroComunero })),
  deleteCommonerLicense: vi.fn((req, res) => res.status(204).send()),
  getCommonerLicenseById: vi.fn((req, res) => res.status(200).json({ id: Number(req.params.id), dni: "73171545" })),
  downloadCommonerLicensePdf: vi.fn((req, res) => res.status(200).set({ "Content-Type": "application/pdf" }).send(Buffer.from("pdf"))),
  downloadCommonerLicensesPdf: vi.fn((req, res) => res.status(200).set({ "Content-Type": "application/pdf" }).send(Buffer.from("pdf"))),
});

const app = require("../../../src/app");
const { createAdminAuthFixture, removeAuthUserFixture, makeAuthToken } = require("../../integration-test-utils");

describe("commoner licenses routes", () => {
  let auth;
  let token;

  beforeAll(async () => {
    auth = await createAdminAuthFixture();
    token = makeAuthToken(auth.user);
  });

  afterAll(async () => {
    await removeAuthUserFixture(auth?.user?.id);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/commoner-licenses");
    expect(res.status).toBe(401);
  });

  it("lists and creates licenses", async () => {
    const list = await request(app)
      .get("/api/commoner-licenses")
      .set({ Authorization: `Bearer ${token}` });

    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(0);

    const created = await request(app)
      .post("/api/commoner-licenses")
      .set({ Authorization: `Bearer ${token}` })
      .send({ dni: "73171545", numeroComunero: "4780" });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ dni: "73171545", licenseNumber: "4780" });
    expect(commonerLicensesController.createCommonerLicense).toHaveBeenCalled();
  });

  it("searches, gets by id and deletes licenses", async () => {
    const search = await request(app)
      .get("/api/commoner-licenses/search/73171545")
      .set({ Authorization: `Bearer ${token}` });

    expect(search.status).toBe(200);
    expect(search.body.data).toHaveLength(0);

    const detail = await request(app)
      .get("/api/commoner-licenses/1")
      .set({ Authorization: `Bearer ${token}` });

    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ id: 1, dni: "73171545" });

    const deleted = await request(app)
      .delete("/api/commoner-licenses/1")
      .set({ Authorization: `Bearer ${token}` });

    expect(deleted.status).toBe(204);
    expect(commonerLicensesController.deleteCommonerLicense).toHaveBeenCalled();
  });

  it("downloads license pdf", async () => {
    const res = await request(app)
      .get("/api/commoner-licenses/1/pdf")
      .set({ Authorization: `Bearer ${token}` });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(commonerLicensesController.downloadCommonerLicensePdf).toHaveBeenCalled();
  });

  it("downloads licenses pdf in bulk", async () => {
    const res = await request(app)
      .get("/api/commoner-licenses/pdf?mode=all")
      .set({ Authorization: `Bearer ${token}` });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(commonerLicensesController.downloadCommonerLicensesPdf).toHaveBeenCalled();
  });

  it("downloads licenses pdf from list values", async () => {
    const res = await request(app)
      .get("/api/commoner-licenses/pdf?mode=list&values=4776,4777,0001")
      .set({ Authorization: `Bearer ${token}` });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(commonerLicensesController.downloadCommonerLicensesPdf).toHaveBeenCalled();
  });
});
