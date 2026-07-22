const {
  normalizeRoleName,
  getRoleGroup,
  getAllowedModuleKeys,
  canAccessModule,
  canManageUserRole,
  canManageCertificateLimit,
} = require("../src/utils/access-control.utils");

describe("access-control utils", () => {
  it("normalizes role names", () => {
    expect(normalizeRoleName("Admin" )).toBe("admin");
    expect(normalizeRoleName("Atencion Cliente")).toBe("atencioncliente");
  });

  it("maps roles to groups and permissions", () => {
    expect(getRoleGroup("SuperAdmin")).toBe(1);
    expect(getAllowedModuleKeys("AtencionCliente")).toContain("clients");
    expect(canAccessModule("Supervisor", "users")).toBe(false);
  });

  it("evaluates management rules", () => {
    expect(canManageUserRole("SuperAdmin", "Admin")).toBe(false);
    expect(canManageUserRole("SuperAdmin", "Supervisor")).toBe(true);
    expect(canManageUserRole("Presidente", "Asistente")).toBe(true);
    expect(canManageCertificateLimit("Presidente")).toBe(true);
    expect(canManageCertificateLimit("Asistente")).toBe(false);
  });
});
