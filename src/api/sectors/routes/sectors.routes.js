const express = require("express");
const sectorsController = require("../controllers/sectors.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");
const { requireModuleAccess } = require("../../../middlewares/module-access.middleware");

const router = express.Router();

router.use(authRequired, requireModuleAccess("sectors"));

router.get("/", sectorsController.listSectors);
router.get("/:id", sectorsController.getSectorById);
router.post("/", sectorsController.createSector);
router.put("/:id", sectorsController.updateSector);

module.exports = router;
