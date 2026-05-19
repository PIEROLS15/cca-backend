const buildCertificateCode = (sequence) => `CER-${String(sequence).padStart(6, "0")}`;

const buildCertificateFilters = (query) => ({
  code: query.code ? { contains: query.code } : undefined,
  location: query.location ? { contains: query.location } : undefined,
  mz: query.mz ? { contains: query.mz } : undefined,
  lot: query.lot ? { contains: query.lot } : undefined,
  status: query.status || undefined,
  request: query.requestCode
    ? {
        code: { contains: query.requestCode },
      }
    : undefined,
  client: query.name || query.documentNumber
    ? {
        AND: [
          query.name ? { fullName: { contains: query.name } } : undefined,
          query.documentNumber ? { documentNumber: { contains: query.documentNumber } } : undefined,
        ].filter(Boolean),
      }
    : undefined,
});

module.exports = {
  buildCertificateCode,
  buildCertificateFilters,
};
