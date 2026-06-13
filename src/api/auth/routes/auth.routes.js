const express = require("express");
const authController = require("../controllers/auth.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");

const router = express.Router();

router.post("/login", authController.login);
router.get("/me", authRequired, authController.me);
router.post("/logout", authRequired, authController.logout);
router.patch("/profile", authRequired, authController.updateProfile);
router.post("/change-password", authRequired, authController.changePassword);
router.post("/verify-password", authRequired, authController.verifyPassword);

module.exports = router;
