const formatCertificateSequence = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return null;
  }

  return String(numeric).padStart(6, "0");
};

module.exports = {
  formatCertificateSequence,
};
