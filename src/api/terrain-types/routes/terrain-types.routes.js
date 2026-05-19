const express = require("express");
const terrainTypesController = require("../controllers/terrain-types.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");

const router = express.Router();

router.use(authRequired);

router.get("/", terrainTypesController.listTerrainTypes);
router.get("/:id", terrainTypesController.getTerrainTypeById);
router.post("/", terrainTypesController.createTerrainType);
router.put("/:id", terrainTypesController.updateTerrainType);
router.delete("/:id", terrainTypesController.deleteTerrainType);

module.exports = router;
