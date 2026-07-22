const { sanitizeUser } = require("../../../src/api/users/utils/users.utils");

describe("users utils", () => {
  it("sanitizes a user", () => {
    const result = sanitizeUser({
      id: 1,
      username: "user",
      fullName: "Usuario",
      email: "user@example.com",
      dni: "12345678",
      isActive: true,
      certificateRangeStart: 10,
      certificateRangeEnd: 20,
      lastCertificate: 9,
      role: {
        id: 2,
        name: "Admin",
        description: "Administrador",
        rolePermissions: [{ permission: { key: "users.read" } }],
      },
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-02T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      id: 1,
      username: "user",
      role: {
        id: 2,
        name: "Admin",
        group: expect.any(Number),
        permissions: ["users.read"],
      },
    });
  });
});
