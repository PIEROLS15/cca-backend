const { sanitizeRole } = require("../../../src/api/roles/utils/roles.utils");

describe("roles utils", () => {
  it("sanitizes a role", () => {
    expect(sanitizeRole({
      id: 1,
      name: "Admin",
      description: "Administrador",
      rolePermissions: [{ permission: { id: 2, key: "roles.read", description: "Read" } }],
      createdAt: new Date(),
      updatedAt: new Date(),
    })).toMatchObject({
      id: 1,
      name: "Admin",
      permissions: [{ id: 2, key: "roles.read", description: "Read" }],
    });
  });
});
