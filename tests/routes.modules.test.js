const routeModules = [
  ["auth", require("../src/api/auth/routes/auth.routes")],
  ["roles", require("../src/api/roles/routes/roles.routes")],
  ["users", require("../src/api/users/routes/users.routes")],
  ["sectors", require("../src/api/sectors/routes/sectors.routes")],
  ["terrain-types", require("../src/api/terrain-types/routes/terrain-types.routes")],
  ["clients", require("../src/api/clients/routes/clients.routes")],
  ["certificate-requests", require("../src/api/certificate-requests/routes/certificate-requests.routes")],
  ["certificates", require("../src/api/certificates/routes/certificates.routes")],
  ["assembly-record-requests", require("../src/api/assembly-record-requests/routes/assembly-record-requests.routes")],
  ["dashboard", require("../src/api/dashboard/routes/dashboard.routes")],
  ["reports", require("../src/api/reports/routes/reports.routes")],
  ["public", require("../src/api/public/routes/public.routes")],
];

describe("route modules", () => {
  for (const [name, router] of routeModules) {
    it(`exports a router for ${name}`, () => {
      expect(router).toBeTruthy();
      expect(Array.isArray(router.stack)).toBe(true);
      expect(router.stack.length).toBeGreaterThan(0);
    });
  }
});
