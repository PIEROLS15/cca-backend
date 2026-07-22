const request = require("supertest");
const app = require("../../../src/app");
const { createAdminAuthFixture, removeAuthUserFixture, makeAuthToken } = require("../../integration-test-utils");

describe("certificates routes", () => {
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
    const res = await request(app).get("/api/certificates");
    expect(res.status).toBe(401);
  });

  it("allows authenticated listing", async () => {
    const res = await request(app).get("/api/certificates").set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
  });
});
