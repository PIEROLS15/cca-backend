const express = require("express");
const publicController = require("../controllers/public.controller");

const router = express.Router();

router.get("/certificates/:token", publicController.verifyCertificate);

module.exports = router;
