const asyncHandler = require("../../../utils/async-handler");
const dashboardService = require("../services/dashboard.service");

const getSummary = asyncHandler(async (req, res) => {
  const summary = await dashboardService.getSummary();
  res.json(summary);
});

function parseDateParam(value) {
  if (!value) return undefined;
  return new Date(value + "T00:00:00.000Z");
}

function parseDateParamEnd(value) {
  if (!value) return undefined;
  return new Date(value + "T23:59:59.999Z");
}

const getStatusBreakdown = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await dashboardService.getStatusBreakdown({
    from: parseDateParam(from),
    to: parseDateParamEnd(to),
  });
  res.json(data);
});

const getMonthlyActivity = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const data = await dashboardService.getMonthlyActivity({
    from: parseDateParam(from),
    to: parseDateParamEnd(to),
  });
  res.json(data);
});

const getRecentActivity = asyncHandler(async (req, res) => {
  const data = await dashboardService.getRecentActivity();
  res.json(data);
});

module.exports = {
  getSummary,
  getStatusBreakdown,
  getMonthlyActivity,
  getRecentActivity,
};
