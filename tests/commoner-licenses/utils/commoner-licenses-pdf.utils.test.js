const templates = require("../../../src/pdf/templates");

const buildPdfFromTemplate = vi.fn();
templates.buildPdfFromTemplate = buildPdfFromTemplate;

const { buildCommonerLicensePdf } = require("../../../src/api/commoner-licenses/utils/commoner-licenses-pdf.utils");

describe("commoner licenses pdf utils", () => {
  it("delegates to the commoner license template", async () => {
    buildPdfFromTemplate.mockResolvedValue(Buffer.from("pdf"));

    await expect(buildCommonerLicensePdf({ id: 1 })).resolves.toEqual(Buffer.from("pdf"));
    expect(buildPdfFromTemplate).toHaveBeenCalledWith("commoner-license", { id: 1 });
  });

  it("delegates a batch of licenses to the commoner license template", async () => {
    buildPdfFromTemplate.mockResolvedValue(Buffer.from("pdf"));

    const payload = [{ id: 1 }, { id: 2 }];
    await expect(buildCommonerLicensePdf(payload)).resolves.toEqual(Buffer.from("pdf"));
    expect(buildPdfFromTemplate).toHaveBeenCalledWith("commoner-license", payload);
  });
});
