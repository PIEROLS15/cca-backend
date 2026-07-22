const request = require("supertest");
const app = require("../../../src/app");
const { createAuthUserFixture, removeAuthUserFixture, makeAuthToken } = require("../auth.test-utils");

describe("auth routes", () => {
  let fixture;
  let token;

  beforeAll(async () => {
    fixture = await createAuthUserFixture();
    token = makeAuthToken(fixture.user);
  });

  afterAll(async () => {
    await removeAuthUserFixture(fixture?.user?.id);
  });

  it("logs in through the route", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: fixture.user.username, password: fixture.password });

    expect(res.status).toBe(200);
  });

  it("protects me route", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);

    const authed = await request(app).get("/api/auth/me").set({ Authorization: `Bearer ${token}` });
    expect(authed.status).toBe(200);
  });
});
