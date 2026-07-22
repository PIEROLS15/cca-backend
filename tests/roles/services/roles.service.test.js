const prisma = require("../../../src/config/prisma");
const rolesService = require("../../../src/api/roles/services/roles.service");
const { syncSerialSequences } = require("../../integration-test-utils");

const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

describe("roles service", () => {
  let fixture;

  beforeAll(async () => {
    await syncSerialSequences(["Role", "Permission"]);
  });

  beforeEach(async () => {
    fixture = await rolesService.createRole({
      name: `IT Role ${uniqueSuffix()}`,
      description: "Rol de prueba",
      permissions: [
        { key: `it.role.${uniqueSuffix()}.read`, description: "Read" },
        { key: `it.role.${uniqueSuffix()}.write`, description: "Write" },
      ],
    });
  });

  afterEach(async () => {
    if (!fixture) return;

    await prisma.rolePermission.deleteMany({ where: { roleId: fixture.id } });
    await prisma.role.deleteMany({ where: { id: fixture.id } });
    await prisma.permission.deleteMany({ where: { key: { startsWith: "it.role." } } });
  });

  it("lists roles", async () => {
    const result = await rolesService.listRoles({ page: 1, limit: 10 });

    expect(result.docs.some((role) => role.id === fixture.id)).toBe(true);
  });

  it("gets a role by id", async () => {
    await expect(rolesService.getRoleById(fixture.id)).resolves.toMatchObject({
      id: fixture.id,
      name: fixture.name,
    });
  });

  it("creates a role with permissions", async () => {
    const created = await rolesService.createRole({
      name: `IT Role Create ${uniqueSuffix()}`,
      description: "Nuevo rol",
      permissions: [{ key: `it.role.create.${uniqueSuffix()}`, description: "Create" }],
    });

    try {
      expect(created.permissions).toHaveLength(1);
      expect(created.permissions[0].key).toMatch(/^it\.role\.create\./);
    } finally {
      await prisma.rolePermission.deleteMany({ where: { roleId: created.id } });
      await prisma.role.deleteMany({ where: { id: created.id } });
      await prisma.permission.deleteMany({ where: { key: { startsWith: "it.role." } } });
    }
  });

  it("updates a role and permissions", async () => {
    const updated = await rolesService.updateRole(fixture.id, {
      name: `${fixture.name} Updated`,
      description: "Actualizado",
      permissions: [{ key: `it.role.${uniqueSuffix()}.updated`, description: "Updated" }],
    });

    expect(updated.name).toMatch(/Updated$/);
    expect(updated.permissions).toHaveLength(1);
  });

  it("returns a delete preview and deletes a role", async () => {
    const preview = await rolesService.getRoleDeletePreview(fixture.id);
    expect(preview.canDelete).toBe(true);

    await rolesService.deleteRole(fixture.id);

    const found = await prisma.role.findUnique({ where: { id: fixture.id } });
    expect(found).toBeNull();

    fixture = null;
  });
});
