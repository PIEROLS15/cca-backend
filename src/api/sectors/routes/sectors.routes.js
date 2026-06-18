const express = require("express");
const sectorsController = require("../controllers/sectors.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");
const { requireModuleAccess } = require("../../../middlewares/module-access.middleware");

const router = express.Router();

const requireSectorsReadAccess = requireModuleAccess("sectors", { readOnlyGroups: [4] });
const requireSectorsWriteAccess = requireModuleAccess("sectors");

router.use(authRequired);

router.get("/", requireSectorsReadAccess, sectorsController.listSectors);
router.get("/:id/delete-preview", requireSectorsReadAccess, sectorsController.previewDeleteSector);
router.get("/:id", requireSectorsReadAccess, sectorsController.getSectorById);
router.post("/", requireSectorsWriteAccess, sectorsController.createSector);
router.put("/:id", requireSectorsWriteAccess, sectorsController.updateSector);
router.delete("/:id", requireSectorsWriteAccess, sectorsController.deleteSector);

module.exports = router;
