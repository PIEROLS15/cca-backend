const CERTIFICATE_RANGE_DEFAULT_LENGTH = 2000;

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

const normalizeCertificateSequenceInput = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return NaN;
  }

  return numeric;
};

const resolveCertificateRangeBounds = ({ start, end, length = CERTIFICATE_RANGE_DEFAULT_LENGTH }) => {
  const normalizedStart = normalizeCertificateSequenceInput(start);
  const normalizedEnd = normalizeCertificateSequenceInput(end);

  if (Number.isNaN(normalizedStart) || Number.isNaN(normalizedEnd)) {
    return { start: NaN, end: NaN };
  }

  if (normalizedStart === undefined && normalizedEnd === undefined) {
    return { start: null, end: null };
  }

  if (normalizedStart !== undefined && normalizedStart !== null && normalizedEnd !== undefined && normalizedEnd !== null) {
    return { start: normalizedStart, end: normalizedEnd };
  }

  if (normalizedStart !== undefined && normalizedStart !== null) {
    return { start: normalizedStart, end: normalizedStart + length - 1 };
  }

  if (normalizedEnd !== undefined && normalizedEnd !== null) {
    return { start: normalizedEnd - length + 1, end: normalizedEnd };
  }

  return { start: null, end: null };
};

module.exports = {
  CERTIFICATE_RANGE_DEFAULT_LENGTH,
  formatCertificateSequence,
  normalizeCertificateSequenceInput,
  resolveCertificateRangeBounds,
};
