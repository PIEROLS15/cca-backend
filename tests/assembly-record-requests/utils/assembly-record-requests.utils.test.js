const {
  buildAssemblyRequestCode,
  formatAssemblyRecordRequestResponse,
  normalizeAssemblyRecordAttachments,
  normalizeAssemblyRecordLegacyAttachments,
  normalizeAssemblyRecordRequestStatus,
  formatAssemblyRecordRequestStatus,
} = require("../../../src/api/assembly-record-requests/utils/assembly-record-requests.utils");
const {
  createAssemblyRecordRequestFixture,
  removeAssemblyRecordRequestFixture,
} = require("../assembly-record-requests.test-utils");

describe("assembly-record-requests utils", () => {
  let fixture;
  let legacyFixture;

  beforeAll(async () => {
    fixture = await createAssemblyRecordRequestFixture({
      attachments: [{ type: "CertPosesion" }, { type: "PlanoMemoria" }],
      legacyPayload: { typeUser: "comunero" },
    });

    legacyFixture = await createAssemblyRecordRequestFixture({
      description: `Legacy fixture ${Date.now()}`,
      attachments: ["CertPosesion", "PlanoMemoria", "Observacion de Registros (Esquela de observacion)"],
      legacyPayload: {
        attach: ["CertPosesion"],
        attachment: ["PlanoMemoria"],
        attachments: ["Observacion de Registros (Esquela de observacion)"],
      },
    });
  });

  afterAll(async () => {
    await removeAssemblyRecordRequestFixture(fixture?.id);
    await removeAssemblyRecordRequestFixture(legacyFixture?.id);
  });

  it("builds request codes from a real record id", () => {
    expect(buildAssemblyRequestCode(fixture.id)).toBe(`SOL-ACTA-${String(fixture.id).padStart(6, "0")}`);
  });

  it("normalizes request statuses from a real record", () => {
    expect(normalizeAssemblyRecordRequestStatus(fixture.status)).toBe("EnProceso");
    expect(formatAssemblyRecordRequestStatus("EnProceso")).toBe("En Proceso");
  });

  it("normalizes attachments from a real record", () => {
    expect(normalizeAssemblyRecordAttachments(fixture.attachments, fixture.legacyPayload)).toEqual([
      { type: "CertPosesion" },
      { type: "PlanoMemoria" },
    ]);
  });

  it("normalizes legacy attachments from a real record", () => {
    expect(
      normalizeAssemblyRecordLegacyAttachments(legacyFixture.attachments, legacyFixture.legacyPayload)
    ).toEqual(expect.arrayContaining([
      "Certificado de posesion",
      "Plano y memoria",
      "Observacion de Registros (Esquela de observacion)",
    ]));
  });

  it("formats a real assembly request response", () => {
    expect(formatAssemblyRecordRequestResponse(fixture)).toMatchObject({
      _id: fixture.code,
      code: fixture.code,
      clientId: fixture.clientId,
      certificateId: fixture.certificateId,
      userId: fixture.userId,
      status: "En Proceso",
      client: {
        id: fixture.client.id,
        fullName: fixture.client.fullName,
      },
      certificate: {
        id: fixture.certificate.id,
        certificateNumber: fixture.certificate.certificateNumber,
      },
    });
  });
});
