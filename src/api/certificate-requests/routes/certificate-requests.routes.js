const express = require("express");
const certificateRequestsController = require("../controllers/certificate-requests.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");

const router = express.Router();

router.use(authRequired);

router.get("/", certificateRequestsController.listCertificateRequests);
router.get("/role-view", certificateRequestsController.getRoleView);
router.get("/:id", certificateRequestsController.getCertificateRequestById);
router.get("/:id/pdf", certificateRequestsController.downloadCertificateRequestPdf);
router.post("/", certificateRequestsController.createCertificateRequest);
router.put("/:id", certificateRequestsController.updateCertificateRequest);
router.delete("/:id", certificateRequestsController.deleteCertificateRequest);

module.exports = router;
