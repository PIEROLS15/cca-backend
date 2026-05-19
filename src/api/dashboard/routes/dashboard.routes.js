const express = require("express");
const dashboardController = require("../controllers/dashboard.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");

const router = express.Router();

router.use(authRequired);
router.get("/summary", dashboardController.getSummary);

module.exports = router;
