const templates = require("../../../src/pdf/templates");
const buildPdfFromTemplate = vi.fn();
templates.buildPdfFromTemplate = buildPdfFromTemplate;

const { buildCertificatePdf } = require("../../../src/api/certificates/utils/certificates-pdf.utils");

describe("certificates pdf utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a certificate pdf", async () => {
    buildPdfFromTemplate.mockResolvedValue(Buffer.from("pdf"));

    await expect(buildCertificatePdf({ id: 1 })).resolves.toEqual(Buffer.from("pdf"));
    expect(buildPdfFromTemplate).toHaveBeenCalledWith("certificate", { id: 1 });
  });
});
