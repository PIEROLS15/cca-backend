const jwt = require("jsonwebtoken");
const { createAccessToken, sanitizeUser } = require("../../../src/api/auth/utils/auth.utils");

describe("auth utils", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  it("creates access tokens with the expected payload", () => {
    const token = createAccessToken({
      id: 1,
      username: "admin",
      role: {
        id: 2,
        name: "Admin",
        rolePermissions: [{ permission: { key: "users.read" } }, { permission: { key: "users.write" } }],
      },
    });

    expect(jwt.verify(token, process.env.JWT_SECRET)).toMatchObject({
      sub: 1,
      role: "Admin",
      roleId: 2,
      roleGroup: 1,
      permissions: ["users.read", "users.write"],
      username: "admin",
    });
  });

  it("sanitizes users with role data", () => {
    const createdAt = new Date("2024-01-01T00:00:00.000Z");
    const updatedAt = new Date("2024-02-01T00:00:00.000Z");

    expect(
      sanitizeUser({
        id: 1,
        username: "admin",
        fullName: "Admin User",
        email: "admin@example.com",
        dni: "12345678",
        isActive: true,
        certificateRangeStart: 10,
        certificateRangeEnd: 20,
        lastCertificate: 12,
        role: {
          id: 2,
          name: "Admin",
          description: "Acceso total",
          rolePermissions: [{ permission: { key: "users.read" } }],
        },
        createdAt,
        updatedAt,
      })
    ).toEqual({
      id: 1,
      username: "admin",
      fullName: "Admin User",
      email: "admin@example.com",
      dni: "12345678",
      isActive: true,
      certificateRangeStart: 10,
      certificateRangeEnd: 20,
      lastCertificate: "000012",
      role: {
        id: 2,
        name: "Admin",
        description: "Acceso total",
        group: 1,
        permissions: ["users.read"],
      },
      createdAt,
      updatedAt,
    });
  });

  it("sanitizes users without role data", () => {
    expect(
      sanitizeUser({
        id: 2,
        username: "guest",
        fullName: "Guest User",
        email: null,
        dni: null,
        isActive: false,
        certificateRangeStart: null,
        certificateRangeEnd: null,
        lastCertificate: null,
        role: null,
        createdAt: null,
        updatedAt: null,
      })
    ).toMatchObject({
      id: 2,
      username: "guest",
      role: null,
      lastCertificate: null,
    });
  });
});
