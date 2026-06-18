const express = require("express");
const certificatesController = require("../controllers/certificates.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");
const { requireModuleAccess } = require("../../../middlewares/module-access.middleware");

const router = express.Router();

const requireCertificatesReadAccess = requireModuleAccess("certificates", { readOnlyGroups: [4] });
const requireCertificatesWriteAccess = requireModuleAccess("certificates");
const requireCertificateStatusUpdateAccess = (req, res, next) => {
  if (req.user?.roleGroup === 4) {
    const bodyKeys = Object.keys(req.body || {});
    if (bodyKeys.length === 1 && bodyKeys.includes("status")) {
      return next();
    }
  }

  return requireCertificatesWriteAccess(req, res, next);
};

router.use(authRequired);

router.get("/", requireCertificatesReadAccess, certificatesController.listCertificates);
router.get("/download/:filename", requireCertificatesReadAccess, certificatesController.downloadCertificatePdfByFilename);
router.get("/by-number/:number", requireCertificatesReadAccess, certificatesController.lookupCertificateByNumber);
router.get("/:id/delete-preview", requireCertificatesReadAccess, certificatesController.previewDeleteCertificate);
router.get("/:id", requireCertificatesReadAccess, certificatesController.getCertificateById);
router.get("/:id/pdf", requireCertificatesReadAccess, certificatesController.downloadCertificatePdf);
router.post("/", requireCertificatesWriteAccess, certificatesController.createCertificate);
router.put("/:id", requireCertificateStatusUpdateAccess, certificatesController.updateCertificate);
router.delete("/:id", requireCertificatesWriteAccess, certificatesController.deleteCertificate);

module.exports = router;
