const express = require("express");
const commonerLicensesController = require("../controllers/commoner-licenses.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");
const { requireModuleAccess } = require("../../../middlewares/module-access.middleware");

const router = express.Router();

router.use(authRequired, requireModuleAccess("commoner-licenses"));

router.get("/", commonerLicensesController.listCommonerLicenses);
router.get("/search/:term", commonerLicensesController.searchCommonerLicenses);
router.get("/pdf", commonerLicensesController.downloadCommonerLicensesPdf);
router.get("/:id/pdf", commonerLicensesController.downloadCommonerLicensePdf);
router.get("/:id", commonerLicensesController.getCommonerLicenseById);
router.post("/", commonerLicensesController.createCommonerLicense);
router.delete("/:id", commonerLicensesController.deleteCommonerLicense);

module.exports = router;
