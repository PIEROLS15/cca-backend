const {
  formatCertificateSequence,
  normalizeCertificateSequenceInput,
  resolveCertificateRangeBounds,
} = require("../src/utils/certificate-range.utils");

describe("certificate-range utils", () => {
  it("formats certificate sequences", () => {
    expect(formatCertificateSequence(12)).toBe("000012");
    expect(formatCertificateSequence(0)).toBe(null);
  });

  it("normalizes range inputs", () => {
    expect(normalizeCertificateSequenceInput(5)).toBe(5);
    expect(normalizeCertificateSequenceInput("")).toBe(null);
    expect(Number.isNaN(normalizeCertificateSequenceInput("abc"))).toBe(true);
  });

  it("resolves bounds from one or two inputs", () => {
    expect(resolveCertificateRangeBounds({ start: 10 })).toEqual({ start: 10, end: 2009 });
    expect(resolveCertificateRangeBounds({ end: 20 })).toEqual({ start: -1979, end: 20 });
    expect(resolveCertificateRangeBounds({ start: 10, end: 20 })).toEqual({ start: 10, end: 20 });
  });
});
