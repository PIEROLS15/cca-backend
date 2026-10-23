const { drawHeaderCode, formatHeaderCode } = require("../../../src/pdf/templates/certificate.template");

const createDocStub = (factor = 0.6) => {
  const calls = [];

  return {
    calls,
    _fontSize: 12,
    fillColor(color) {
      calls.push({ type: "fillColor", color });
      return this;
    },
    fillOpacity(value) {
      calls.push({ type: "fillOpacity", value });
      return this;
    },
    font(name) {
      calls.push({ type: "font", name, fontSize: this._fontSize });
      return this;
    },
    fontSize(size) {
      this._fontSize = size;
      calls.push({ type: "fontSize", size });
      return this;
    },
    widthOfString(text) {
      return String(text ?? "").length * this._fontSize * factor;
    },
    text(text, x, y, options) {
      calls.push({ type: "text", text: String(text), x, y, options, fontSize: this._fontSize });
      return this;
    },
  };
};

describe("certificate template header code", () => {
  it("formats the code label", () => {
    expect(formatHeaderCode("024421")).toBe("Nº 024421");
  });

  it("draws the header code in the top right corner", () => {
    const doc = createDocStub(0.6);

    drawHeaderCode(doc, "024421");

    const textCall = doc.calls.find((call) => call.type === "text");

    expect(textCall).toBeDefined();
    expect(textCall.text).toBe("Nº 024421");
    expect(textCall.x).toBeCloseTo(411.0, 1);
    expect(textCall.y).toBeCloseTo(28.3, 1);
    expect(textCall.options).toMatchObject({
      align: "right",
      lineBreak: false,
    });
    expect(textCall.options.width).toBeGreaterThan(85);
    expect(textCall.options.width).toBeLessThan(90);
    expect(textCall.x + textCall.options.width).toBeCloseTo(498.2, 1);
    expect(textCall.fontSize).toBe(13);
  });

  it("reduces the font size when the code is long", () => {
    const doc = createDocStub(0.6);

    drawHeaderCode(doc, "024421-EXTRA-LONG-CERTIFICATE-NUMBER");

    const textCall = doc.calls.find((call) => call.type === "text");

    expect(textCall).toBeDefined();
    expect(textCall.fontSize).toBe(10);
  });
});
