const express = require("express");
const assemblyRecordRequestsController = require("../controllers/assembly-record-requests.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");
const { requireModuleAccess } = require("../../../middlewares/module-access.middleware");

const router = express.Router();

router.use(authRequired, requireModuleAccess("assembly-record-requests"));

router.get("/", assemblyRecordRequestsController.listAssemblyRecordRequests);
router.get("/download/:filename", assemblyRecordRequestsController.downloadAssemblyRecordRequestPdfByFilename);
router.get("/:id/delete-preview", assemblyRecordRequestsController.previewDeleteAssemblyRecordRequest);
router.get("/:id", assemblyRecordRequestsController.getAssemblyRecordRequestById);
router.get("/:id/preview", assemblyRecordRequestsController.previewAssemblyRecordRequest);
router.get("/:id/pdf", assemblyRecordRequestsController.downloadAssemblyRecordRequestPdf);
router.post("/", assemblyRecordRequestsController.createAssemblyRecordRequest);
router.put("/:id", assemblyRecordRequestsController.updateAssemblyRecordRequest);
router.delete("/:id", assemblyRecordRequestsController.deleteAssemblyRecordRequest);

module.exports = router;
