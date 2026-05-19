const asyncHandler = require("../../../utils/async-handler");
const dashboardService = require("../services/dashboard.service");

const getSummary = asyncHandler(async (req, res) => {
  const summary = await dashboardService.getSummary();
  res.json(summary);
});

module.exports = {
  getSummary,
};
