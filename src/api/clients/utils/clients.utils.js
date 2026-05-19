const normalizeClientPayload = (payload) => ({
  fullName: payload.fullName?.trim(),
  documentNumber: payload.documentNumber?.trim(),
  address: payload.address?.trim() || null,
  phone: payload.phone?.trim() || null,
  clientType: payload.clientType,
});

module.exports = {
  normalizeClientPayload,
};
