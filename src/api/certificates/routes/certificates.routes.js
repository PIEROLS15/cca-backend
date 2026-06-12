const express = require("express");
const certificatesController = require("../controllers/certificates.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");
const { requireModuleAccess } = require("../../../middlewares/module-access.middleware");

const router = express.Router();

router.use(authRequired, requireModuleAccess("certificates"));

router.get("/", certificatesController.listCertificates);
router.get("/download/:filename", certificatesController.downloadCertificatePdfByFilename);
router.get("/by-number/:number", certificatesController.lookupCertificateByNumber);
router.get("/:id/delete-preview", certificatesController.previewDeleteCertificate);
router.get("/:id", certificatesController.getCertificateById);
router.get("/:id/pdf", certificatesController.downloadCertificatePdf);
router.post("/", certificatesController.createCertificate);
router.put("/:id", certificatesController.updateCertificate);
router.delete("/:id", certificatesController.deleteCertificate);

module.exports = router;
