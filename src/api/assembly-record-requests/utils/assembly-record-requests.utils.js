const buildAssemblyRequestCode = (sequence) => `SOL-ACTA-${String(sequence).padStart(6, "0")}`;

module.exports = {
  buildAssemblyRequestCode,
};
