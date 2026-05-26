const express = require("express");
const authController = require("../controllers/auth.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");

const router = express.Router();

router.post("/login", authController.login);
router.post("/logout", authRequired, authController.logout);

module.exports = router;
