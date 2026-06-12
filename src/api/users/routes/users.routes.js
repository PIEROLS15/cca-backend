const express = require("express");
const usersController = require("../controllers/users.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");
const { requireModuleAccess } = require("../../../middlewares/module-access.middleware");

const router = express.Router();

router.use(authRequired, requireModuleAccess("users"));

router.get("/", usersController.listUsers);
router.get("/:id", usersController.getUserById);
router.post("/", usersController.createUser);
router.put("/:id", usersController.updateUser);
router.patch("/:id/status", usersController.updateUserStatus);
router.delete("/:id", usersController.deleteUser);

module.exports = router;
