const notFoundHandler = (req, res) => {
  const status = 404;

  res.status(status).json({
    message: `Endpoint no encontrado: ${req.method} ${req.originalUrl}`,
    error: true,
    status,
    data: null,
  });
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Error interno del servidor";

  res.status(statusCode).json({
    message,
    error: true,
    status: statusCode,
    data: null,
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
