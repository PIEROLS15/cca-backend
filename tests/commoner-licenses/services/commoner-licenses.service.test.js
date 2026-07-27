const os = require("os");
const path = require("path");
const fs = require("fs/promises");

const prisma = require("../../../src/config/prisma");
const reniecService = require("../../../src/api/commoner-licenses/services/reniec.service");
const commonerLicensesService = require("../../../src/api/commoner-licenses/services/commoner-licenses.service");

Object.assign(reniecService, {
  searchDetailedByDocument: vi.fn(),
});

const uploadFile = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAGgwJ/l4m+wQAAAABJRU5ErkJggg==";
const uniqueValue = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

describe("commoner licenses service", () => {
  const uploadDir = path.join(os.tmpdir(), "cca-commoner-licenses-tests", uniqueValue("uploads"));

  beforeAll(async () => {
    process.env.COMMONER_LICENSE_UPLOAD_DIR = uploadDir;
    process.env.COMMONER_LICENSE_PUBLIC_PREFIX = "/uploads/commoners";
    process.env.RENIEC_PROVIDER = "codart";
    process.env.RENIEC_CODART_TOKEN = "token";
    process.env.RENIEC_CODART_URL = "https://reniec.test/";
  });

  afterAll(async () => {
    await fs.rm(uploadDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    reniecService.searchDetailedByDocument.mockResolvedValue({
      dni: "73171545",
      firstNames: "ANA LUCIA",
      lastNames: "HUAMAN CASTRO",
      fullName: "ANA LUCIA HUAMAN CASTRO",
      gender: "FEMENINO",
      birthDate: "15/04/2003",
      address: "ANEXO SAN JUAN MZ.A-10 LT.2 LOS GIRASOLES I ETAPA",
      photoDataUri: uploadFile,
    });

    await prisma.commonerLicense.deleteMany();
    await fs.rm(uploadDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await prisma.commonerLicense.deleteMany();
    await fs.rm(uploadDir, { recursive: true, force: true });
  });

  it("creates a record and stores the image file", async () => {
    const created = await commonerLicensesService.createCommonerLicense({
      dni: "73171545",
      numeroComunero: "4780",
    });

    expect(created).toMatchObject({
      dni: "73171545",
      licenseNumber: "4780",
      hasPhoto: true,
    });

    expect(created.photoUrl).toMatch(/^\/uploads\/commoners\/dni-73171545-carnet-4780.*\.png$/);

    const savedFile = path.join(uploadDir, path.basename(created.photoUrl));
    await expect(fs.access(savedFile)).resolves.toBeUndefined();
  });

  it("rejects duplicated records", async () => {
    await commonerLicensesService.createCommonerLicense({
      dni: "73171545",
      numeroComunero: "4780",
    });

    await expect(
      commonerLicensesService.createCommonerLicense({
        dni: "73171545",
        numeroComunero: "4781",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
