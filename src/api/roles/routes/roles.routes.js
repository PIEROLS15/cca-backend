const express = require("express");
const rolesController = require("../controllers/roles.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");
const { requireModuleAccess } = require("../../../middlewares/module-access.middleware");

const router = express.Router();

router.use(authRequired, requireModuleAccess("roles"));

router.get("/", rolesController.listRoles);
router.get("/:id/delete-preview", rolesController.previewDeleteRole);
router.get("/:id", rolesController.getRoleById);
router.post("/", rolesController.createRole);
router.put("/:id", rolesController.updateRole);
router.delete("/:id", rolesController.deleteRole);

module.exports = router;
