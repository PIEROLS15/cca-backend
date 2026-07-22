const { buildAssemblyRecordRequestPdf } = require("../../../src/api/assembly-record-requests/utils/assembly-record-requests-pdf.utils");
const {
  createAssemblyRecordRequestFixture,
  removeAssemblyRecordRequestFixture,
} = require("../assembly-record-requests.test-utils");

describe("assembly-record-requests pdf utils", () => {
  let fixture;

  beforeAll(async () => {
    fixture = await createAssemblyRecordRequestFixture({
      description: `PDF fixture ${Date.now()}`,
      attachments: [{ type: "CertPosesion" }, { type: "PlanoMemoria" }],
      legacyPayload: { typeUser: "comunero" },
    });
  });

  afterAll(async () => {
    await removeAssemblyRecordRequestFixture(fixture?.id);
  });

  it("builds the assembly record request pdf from a real record", async () => {
    const buffer = await buildAssemblyRecordRequestPdf(fixture);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
