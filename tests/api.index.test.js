const apiRouter = require("../src/api");
const authRoutes = require("../src/api/auth/routes/auth.routes");
const rolesRoutes = require("../src/api/roles/routes/roles.routes");
const usersRoutes = require("../src/api/users/routes/users.routes");
const sectorsRoutes = require("../src/api/sectors/routes/sectors.routes");
const terrainTypesRoutes = require("../src/api/terrain-types/routes/terrain-types.routes");
const clientsRoutes = require("../src/api/clients/routes/clients.routes");
const certificateRequestsRoutes = require("../src/api/certificate-requests/routes/certificate-requests.routes");
const certificatesRoutes = require("../src/api/certificates/routes/certificates.routes");
const assemblyRecordRequestsRoutes = require("../src/api/assembly-record-requests/routes/assembly-record-requests.routes");
const dashboardRoutes = require("../src/api/dashboard/routes/dashboard.routes");
const reportsRoutes = require("../src/api/reports/routes/reports.routes");
const publicRoutes = require("../src/api/public/routes/public.routes");

describe("api router", () => {
  it("mounts every module router", () => {
    const handles = apiRouter.stack.map((layer) => layer.handle);

    expect(handles).toEqual(expect.arrayContaining([
      authRoutes,
      rolesRoutes,
      usersRoutes,
      sectorsRoutes,
      terrainTypesRoutes,
      clientsRoutes,
      certificateRequestsRoutes,
      certificatesRoutes,
      assemblyRecordRequestsRoutes,
      dashboardRoutes,
      reportsRoutes,
      publicRoutes,
    ]));
  });
});
