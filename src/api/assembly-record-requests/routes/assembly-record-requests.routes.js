const express = require("express");
const assemblyRecordRequestsController = require("../controllers/assembly-record-requests.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");
const { requireModuleAccess } = require("../../../middlewares/module-access.middleware");

const router = express.Router();

const requireAssemblyRecordRequestWriteAccess = requireModuleAccess("assembly-record-requests");
const requireAssemblyRecordRequestStatusUpdateAccess = (req, res, next) => {
  if (req.user?.roleGroup === 4) {
    const bodyKeys = Object.keys(req.body || {});
    if (bodyKeys.length === 1 && bodyKeys.includes("status")) {
      return next();
    }
  }

  return requireAssemblyRecordRequestWriteAccess(req, res, next);
};

router.use(authRequired, requireModuleAccess("assembly-record-requests", { readOnlyGroups: [4] }));

router.get("/", assemblyRecordRequestsController.listAssemblyRecordRequests);
router.get("/download/:filename", assemblyRecordRequestsController.downloadAssemblyRecordRequestPdfByFilename);
router.get("/:id/delete-preview", assemblyRecordRequestsController.previewDeleteAssemblyRecordRequest);
router.get("/:id", assemblyRecordRequestsController.getAssemblyRecordRequestById);
router.get("/:id/preview", assemblyRecordRequestsController.previewAssemblyRecordRequest);
router.get("/:id/pdf", assemblyRecordRequestsController.downloadAssemblyRecordRequestPdf);
router.post("/", assemblyRecordRequestsController.createAssemblyRecordRequest);
router.put("/:id", requireAssemblyRecordRequestStatusUpdateAccess, assemblyRecordRequestsController.updateAssemblyRecordRequest);
router.delete("/:id", assemblyRecordRequestsController.deleteAssemblyRecordRequest);

module.exports = router;
