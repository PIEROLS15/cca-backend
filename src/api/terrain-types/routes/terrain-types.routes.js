const express = require("express");
const terrainTypesController = require("../controllers/terrain-types.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");
const { requireModuleAccess } = require("../../../middlewares/module-access.middleware");

const router = express.Router();

router.use(authRequired, requireModuleAccess("terrain-types"));

router.get("/", terrainTypesController.listTerrainTypes);
router.get("/:id/delete-preview", terrainTypesController.previewDeleteTerrainType);
router.get("/:id", terrainTypesController.getTerrainTypeById);
router.post("/", terrainTypesController.createTerrainType);
router.put("/:id", terrainTypesController.updateTerrainType);
router.delete("/:id", terrainTypesController.deleteTerrainType);

module.exports = router;
