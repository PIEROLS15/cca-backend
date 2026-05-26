const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const apiRouter = require("./api");
const { notFoundHandler, errorHandler } = require("./middlewares/error.middleware");

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:9000",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
