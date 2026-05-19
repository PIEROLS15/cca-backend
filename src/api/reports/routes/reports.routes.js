const express = require("express");
const reportsController = require("../controllers/reports.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");

const router = express.Router();

router.use(authRequired);
router.get("/certificates", reportsController.exportCertificatesReport);

module.exports = router;
