const express = require("express");
const reportsController = require("../controllers/reports.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");
const { requireModuleAccess } = require("../../../middlewares/module-access.middleware");

const router = express.Router();

router.use(authRequired, requireModuleAccess("reports"));
router.get("/certificates", reportsController.exportCertificatesReport);

module.exports = router;
