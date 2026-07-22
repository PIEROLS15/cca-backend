const prisma = require("../../../src/config/prisma");
const certificatesService = require("../../../src/api/certificates/services/certificates.service");
const { ensureBaseRoles } = require("../../../src/utils/role.utils");
const { createAuthUserFixture, removeAuthUserFixture } = require("../../auth/auth.test-utils");
const { syncSerialSequences } = require("../../integration-test-utils");

const uniqueValue = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

describe("certificates service", () => {
  let issuer;
  let sector;
  let terrainType;
  let owner;
  let fixture;

  const cleanupCertificate = async (certificateId) => {
    if (!certificateId) return;

    await prisma.documentStatusHistory.deleteMany({
      where: {
        documentType: "certificate",
        documentId: certificateId,
      },
    });

    await prisma.certificate.deleteMany({ where: { id: certificateId } });
  };

  const buildCertificatePayload = () => ({
    owners: [
      {
        id: owner.id,
        fullName: owner.fullName,
        documentNumber: owner.documentNumber || owner.clientCode,
      },
    ],
    requestNumber: uniqueValue("REQ"),
    terrain: {
      terrainType: { id: terrainType.id },
      measurementModeUsed: "RECTANGULAR_AUTO",
      width: 10,
      length: 10,
      totalArea: 100,
      area: 100,
      perimeter: 40,
    },
    location: {
      sectors: { id: sector.id },
      mz: "A",
      lot: "1",
    },
    borders: {
      north: "Norte",
      south: "Sur",
      east: "Este",
      west: "Oeste",
    },
    status: "Recepcionado",
  });

  beforeAll(async () => {
    await ensureBaseRoles();
    await syncSerialSequences(["User", "Certificate", "CertificateOwner", "DocumentStatusHistory"]);

    const [sectorRow, terrainTypeRow, ownerRow] = await Promise.all([
      prisma.sector.findFirst({ orderBy: { id: "asc" } }),
      prisma.terrainType.findFirst({ orderBy: { id: "asc" } }),
      prisma.client.findFirst({
        where: {
          OR: [
            { documentNumber: { not: null } },
            { clientCode: { not: null } },
          ],
        },
        orderBy: { id: "asc" },
      }),
    ]);

    sector = sectorRow;
    terrainType = terrainTypeRow;
    owner = ownerRow;

    if (!sector || !terrainType || !owner) {
      throw new Error("Faltan datos base para pruebas de certificados");
    }

    const role = await prisma.role.findUnique({ where: { name: "AtencionCliente" } });
    issuer = await createAuthUserFixture({
      role,
      username: uniqueValue("issuer"),
      fullName: `Emisor IT ${uniqueValue("issuer")}`,
      email: `${uniqueValue("issuer")}@example.com`,
      dni: `${Math.floor(10000000 + Math.random() * 90000000)}`,
      certificateRangeStart: 990000,
      certificateRangeEnd: 990010,
    });
  });

  afterAll(async () => {
    if (fixture?.id) {
      await cleanupCertificate(fixture.id);
    }

    if (issuer?.user?.id) {
      await removeAuthUserFixture(issuer.user.id);
    }
  });

  beforeEach(async () => {
    fixture = await certificatesService.createCertificate(buildCertificatePayload(), issuer.user.id);
  });

  afterEach(async () => {
    if (!fixture?.id) return;

    await cleanupCertificate(fixture.id);
    fixture = null;
  });

  it("lists certificates", async () => {
    const result = await certificatesService.listCertificates({ search: fixture.certificateNumber, page: 1, limit: 10 });
    expect(result.docs.some((certificate) => certificate.id === fixture.id)).toBe(true);
  });

  it("gets a certificate by id and by number", async () => {
    await expect(certificatesService.getCertificateById(fixture.id)).resolves.toMatchObject({
      id: fixture.id,
      certificateNumber: fixture.certificateNumber,
    });

    await expect(certificatesService.getCertificateByNumber(fixture.certificateNumber)).resolves.toMatchObject({
      id: fixture.id,
      certificateNumber: fixture.certificateNumber,
    });
  });

  it("verifies a certificate by token", async () => {
    await expect(certificatesService.getCertificateVerificationByToken(fixture.verificationToken)).resolves.toMatchObject({
      certificate: {
        certificateNumber: fixture.certificateNumber,
      },
    });
  });

  it("updates a certificate status", async () => {
    const updated = await certificatesService.updateCertificate(fixture.id, {
      status: "Observado",
      note: "Falta validar datos",
    }, issuer.user.id);

    expect(updated.status).toBe("Observado");
    expect(updated.statusNote).toBe("Falta validar datos");
  });

  it("creates and deletes a certificate", async () => {
    const created = await certificatesService.createCertificate(buildCertificatePayload(), issuer.user.id);

    try {
      expect(created.certificateNumber).toMatch(/^\d{6}$/);

      const preview = await certificatesService.getCertificateDeletePreview(created.id);
      expect(preview.canDelete).toBe(true);

      await certificatesService.deleteCertificate(created.id);
      const found = await prisma.certificate.findUnique({ where: { id: created.id } });
      expect(found).toBeNull();
    } finally {
      await cleanupCertificate(created.id);
    }
  });
});
