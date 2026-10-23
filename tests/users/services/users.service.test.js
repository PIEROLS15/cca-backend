const prisma = require("../../../src/config/prisma");
const { createAuthUserFixture, removeAuthUserFixture } = require("../../auth/auth.test-utils");
const { ensureBaseRoles } = require("../../../src/utils/role.utils");
const usersService = require("../../../src/api/users/services/users.service");
const { syncSerialSequences } = require("../../integration-test-utils");

const uniqueValue = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

describe("users service", () => {
  let fixture;
  let targetRole;

  beforeAll(async () => {
    await ensureBaseRoles();
    await syncSerialSequences(["User", "Role"]);

    targetRole = await prisma.role.findUnique({ where: { name: "AtencionCliente" } });
    if (!targetRole) {
      throw new Error("No se encontró el rol AtencionCliente");
    }
  });

  beforeEach(async () => {
    fixture = await createAuthUserFixture({
      role: targetRole,
      username: uniqueValue("user"),
      fullName: `Usuario IT ${uniqueValue("base")}`,
      email: `${uniqueValue("user")}@example.com`,
      dni: `${Math.floor(10000000 + Math.random() * 90000000)}`,
    });
  });

  afterEach(async () => {
    if (!fixture) return;

    await removeAuthUserFixture(fixture.user.id);
  });

  it("lists users", async () => {
    const result = await usersService.listUsers({ page: 1, limit: 10 });
    expect(result.docs.some((user) => user.id === fixture.user.id)).toBe(true);
  });

  it("gets a user by id", async () => {
    await expect(usersService.getUserById(fixture.user.id)).resolves.toMatchObject({
      id: fixture.user.id,
      username: fixture.user.username,
    });
  });

  it("creates, updates and disables a user", async () => {
    const created = await createAuthUserFixture({
      role: targetRole,
      username: uniqueValue("created"),
      fullName: `Usuario creado ${uniqueValue("x")}`,
      email: `${uniqueValue("created")}@example.com`,
      dni: `${Math.floor(10000000 + Math.random() * 90000000)}`,
    });

    try {
      const updated = await usersService.updateUser(created.user.id, {
        fullName: `${created.user.fullName} Actualizado`,
      }, "Admin");

      expect(updated.fullName).toContain("Actualizado");

      const status = await usersService.updateUserStatus(created.user.id, false, "Admin");
      expect(status.isActive).toBe(false);

      await usersService.deleteUser(created.user.id, "Admin");
      const found = await prisma.user.findUnique({ where: { id: created.user.id } });
      expect(found).toBeNull();
    } finally {
      await removeAuthUserFixture(created.user.id);
    }
  });

  it("requires admin permissions for role changes", async () => {
    await expect(usersService.createUser({
      username: uniqueValue("forbidden"),
      password: "Test1234!",
      fullName: `Usuario restringido ${uniqueValue("x")}`,
      email: `${uniqueValue("forbidden")}@example.com`,
      dni: `${Math.floor(10000000 + Math.random() * 90000000)}`,
      roleId: targetRole.id,
    }, "AtencionCliente")).rejects.toMatchObject({ message: "No tienes permisos para gestionar usuarios de ese grupo" });
  });

  it("creates a user", async () => {
    const created = await usersService.createUser({
      username: uniqueValue("created-user"),
      password: "Test1234!",
      fullName: `Usuario creado ${uniqueValue("x")}`,
      email: `${uniqueValue("created-user")}@example.com`,
      dni: `${Math.floor(10000000 + Math.random() * 90000000)}`,
      roleId: targetRole.id,
    }, "Admin");

    try {
      expect(created.username).toContain("created-user");
    } finally {
      await removeAuthUserFixture(created.id);
    }
  });
});
