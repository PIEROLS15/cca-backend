const express = require("express");
const dashboardController = require("../controllers/dashboard.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");

const router = express.Router();

router.use(authRequired);
router.get("/summary", dashboardController.getSummary);
router.get("/status-breakdown", dashboardController.getStatusBreakdown);
router.get("/monthly-activity", dashboardController.getMonthlyActivity);
router.get("/recent-activity", dashboardController.getRecentActivity);

module.exports = router;
