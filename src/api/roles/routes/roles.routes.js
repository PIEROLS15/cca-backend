const express = require("express");
const rolesController = require("../controllers/roles.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");
const { requireRoles } = require("../../../middlewares/role.middleware");

const router = express.Router();

router.use(authRequired, requireRoles("Admin", "Presidente"));

router.get("/", rolesController.listRoles);
router.get("/:id", rolesController.getRoleById);
router.post("/", rolesController.createRole);
router.put("/:id", rolesController.updateRole);
router.delete("/:id", rolesController.deleteRole);

module.exports = router;
