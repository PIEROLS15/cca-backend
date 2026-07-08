const express = require("express");
const publicController = require("../controllers/public.controller");

const router = express.Router();

router.get("/certificates/:token", publicController.verifyCertificate);
router.get("/tracking/:documentType/:code", publicController.trackDocument);

module.exports = router;
