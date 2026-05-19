const express = require("express");

const authRoutes = require("./auth/routes/auth.routes");
const rolesRoutes = require("./roles/routes/roles.routes");
const usersRoutes = require("./users/routes/users.routes");
const sectorsRoutes = require("./sectors/routes/sectors.routes");
const terrainTypesRoutes = require("./terrain-types/routes/terrain-types.routes");
const clientsRoutes = require("./clients/routes/clients.routes");
const certificateRequestsRoutes = require("./certificate-requests/routes/certificate-requests.routes");
const certificatesRoutes = require("./certificates/routes/certificates.routes");
const assemblyRecordRequestsRoutes = require("./assembly-record-requests/routes/assembly-record-requests.routes");
const dashboardRoutes = require("./dashboard/routes/dashboard.routes");
const reportsRoutes = require("./reports/routes/reports.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/roles", rolesRoutes);
router.use("/users", usersRoutes);
router.use("/sectors", sectorsRoutes);
router.use("/terrain-types", terrainTypesRoutes);
router.use("/clients", clientsRoutes);
router.use("/certificate-requests", certificateRequestsRoutes);
router.use("/certificates", certificatesRoutes);
router.use("/assembly-record-requests", assemblyRecordRequestsRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/reports", reportsRoutes);

module.exports = router;
