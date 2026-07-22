const request = require("supertest");
const app = require("../../../src/app");
const { createAdminAuthFixture, removeAuthUserFixture, makeAuthToken } = require("../../integration-test-utils");

describe("terrain-types routes", () => {
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
    const res = await request(app).get("/api/terrain-types");
    expect(res.status).toBe(401);
  });

  it("allows authenticated listing", async () => {
    const res = await request(app).get("/api/terrain-types").set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
  });
});
