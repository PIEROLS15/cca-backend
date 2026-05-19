const isPaginatedPayload = (data) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }

  return Array.isArray(data.docs) && typeof data.total === "number";
};

const sendSuccess = (res, { message, data, status = 200 }) => {
  if (isPaginatedPayload(data)) {
    const { docs, ...pagination } = data;

    return res.status(status).json({
      message,
      error: false,
      status,
      data: docs,
      ...pagination,
    });
  }

  return res.status(status).json({
    message,
    error: false,
    status,
    data,
  });
};

module.exports = {
  sendSuccess,
};
