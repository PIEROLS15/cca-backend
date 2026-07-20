const jwt = require("jsonwebtoken");
const { createAccessToken, sanitizeUser } = require("../../../src/api/auth/utils/auth.utils");
const { createAuthUserFixture, removeAuthUserFixture } = require("../auth.test-utils");

describe("auth utils", () => {
  let fixture;

  beforeAll(async () => {
    fixture = await createAuthUserFixture({
      username: `utils-${Date.now()}`,
      fullName: "Auth Utils User",
      email: `utils-${Date.now()}@example.com`,
      dni: `${Date.now()}`.slice(-8),
      certificateRangeStart: 10,
      certificateRangeEnd: 20,
      lastCertificate: 12,
    });
  });

  afterAll(async () => {
    await removeAuthUserFixture(fixture?.user?.id);
  });

  it("creates access tokens with the expected payload", () => {
    const token = createAccessToken(fixture.user);

    expect(jwt.verify(token, process.env.JWT_SECRET || "dev-secret")).toMatchObject({
      sub: fixture.user.id,
      role: fixture.user.role.name,
      roleId: fixture.user.role.id,
      roleGroup: expect.any(Number),
      username: fixture.user.username,
    });
  });

  it("sanitizes users with role data from the DB", () => {
    expect(sanitizeUser(fixture.user)).toMatchObject({
      id: fixture.user.id,
      username: fixture.user.username,
      fullName: fixture.user.fullName,
      email: fixture.user.email,
      dni: fixture.user.dni,
      certificateRangeStart: 10,
      certificateRangeEnd: 20,
      lastCertificate: "000012",
      role: {
        id: fixture.user.role.id,
        name: fixture.user.role.name,
      },
    });
  });

  it("sanitizes users without role data", () => {
    const plainUser = { ...fixture.user, role: null };

    expect(sanitizeUser(plainUser)).toMatchObject({
      id: fixture.user.id,
      username: fixture.user.username,
      role: null,
    });
  });
});
