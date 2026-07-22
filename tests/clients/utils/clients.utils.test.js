const {
  buildClientWriteData,
  formatClientCollection,
  formatClientResponse,
  formatLicenseNumber,
  formatClientCode,
  getNextClientCodeSequence,
  getNextLicenseSequence,
  normalizeClientPayload,
  normalizeLicenseSequenceInput,
} = require("../../../src/api/clients/utils/clients.utils");

describe("clients utils", () => {
  it("formats numbers and codes", () => {
    expect(formatLicenseNumber(7)).toBe("0007");
    expect(formatClientCode(7)).toBe("CLI-007");
  });

  it("normalizes license input", () => {
    expect(normalizeLicenseSequenceInput("12")).toBe(12);
    expect(() => normalizeLicenseSequenceInput("abc")).toThrow("licenseSequence debe ser un numero entero positivo");
  });

  it("normalizes client payload", () => {
    expect(normalizeClientPayload({ fullName: "  Juan  ", documentNumber: " 123 ", isComunero: 1 })).toMatchObject({
      fullName: "Juan",
      documentNumber: "123",
      isComunero: true,
    });
  });

  it("gets next client and license sequences", async () => {
    const tx = {
      client: { findMany: vi.fn().mockResolvedValue([{ clientCode: "CLI-001" }, { clientCode: "CLI-009" }]) },
      commoner: { findFirst: vi.fn().mockResolvedValue({ licenseSequence: 4 }) },
    };

    await expect(getNextClientCodeSequence(tx)).resolves.toBe(10);
    await expect(getNextLicenseSequence(tx)).resolves.toBe(5);
  });

  it("formats client responses", () => {
    const client = formatClientResponse({
      id: 1,
      fullName: "Juan",
      documentNumber: "123",
      address: "A",
      phone: "9",
      commoner: { isActive: true, licenseSequence: 7 },
    });

    expect(client).toMatchObject({
      id: 1,
      clientType: "Comunero",
      nro_licence: "0007",
    });
    expect(formatClientCollection([{ id: 1, fullName: "Juan", commoner: null }])).toHaveLength(1);
  });

  it("builds client write data", async () => {
    const tx = {
      client: { findMany: vi.fn().mockResolvedValue([{ clientCode: "CLI-001" }]) },
      commoner: { findFirst: vi.fn().mockResolvedValue({ licenseSequence: 1 }) },
    };

    const data = await buildClientWriteData(tx, {
      fullName: "Juan",
      documentNumber: null,
      isComunero: true,
      noDocument: true,
      actorRoleName: "Admin",
    });

    expect(data).toMatchObject({
      fullName: "Juan",
      documentNumber: null,
      clientCode: "CLI-002",
      commoner: {
        create: { licenseSequence: 2, isActive: true },
      },
    });
  });
});
