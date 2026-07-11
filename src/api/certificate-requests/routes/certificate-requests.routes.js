const express = require("express");
const certificateRequestsController = require("../controllers/certificate-requests.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");
const { requireModuleAccess } = require("../../../middlewares/module-access.middleware");

const router = express.Router();

const requireCertificateRequestWriteAccess = requireModuleAccess("certificate-requests");
const requireCertificateRequestStatusUpdateAccess = (req, res, next) => {
  if (req.user?.roleGroup === 4) {
    const bodyKeys = Object.keys(req.body || {});
    if (bodyKeys.length === 1 && bodyKeys.includes("status")) {
      return next();
    }
  }

  return requireCertificateRequestWriteAccess(req, res, next);
};

router.use(authRequired, requireModuleAccess("certificate-requests", { readOnlyGroups: [4] }));

router.get("/", certificateRequestsController.listCertificateRequests);
router.get("/download/:filename", certificateRequestsController.downloadCertificateRequestPdf);
router.get("/:id/delete-preview", certificateRequestsController.previewDeleteCertificateRequest);
router.get("/:id", certificateRequestsController.getCertificateRequestById);
router.post("/", certificateRequestsController.createCertificateRequest);
router.put("/:id", requireCertificateRequestStatusUpdateAccess, certificateRequestsController.updateCertificateRequest);
router.delete("/:id", certificateRequestsController.deleteCertificateRequest);

module.exports = router;
