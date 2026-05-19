const express = require("express");
const certificatesController = require("../controllers/certificates.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");

const router = express.Router();

router.use(authRequired);

router.get("/", certificatesController.listCertificates);
router.get("/:id", certificatesController.getCertificateById);
router.get("/:id/preview", certificatesController.previewCertificate);
router.get("/:id/pdf", certificatesController.downloadCertificatePdf);
router.post("/", certificatesController.createCertificate);
router.put("/:id", certificatesController.updateCertificate);
router.delete("/:id", certificatesController.deleteCertificate);

module.exports = router;
