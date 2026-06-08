const express = require("express");
const sectorsController = require("../controllers/sectors.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");

const router = express.Router();

router.use(authRequired);

router.get("/", sectorsController.listSectors);
router.get("/:id/delete-preview", sectorsController.previewDeleteSector);
router.get("/:id", sectorsController.getSectorById);
router.post("/", sectorsController.createSector);
router.put("/:id", sectorsController.updateSector);
router.delete("/:id", sectorsController.deleteSector);

module.exports = router;
