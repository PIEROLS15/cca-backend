const prisma = require("../../../src/config/prisma");
const HttpError = require("../../../src/utils/http-error");
const { DOCUMENT_TYPES } = require("../../../src/utils/document-status-history.utils");
const { formatAssemblyRecordRequestResponse } = require("../../../src/api/assembly-record-requests/utils/assembly-record-requests.utils");
const assemblyService = require("../../../src/api/assembly-record-requests/services/assembly-record-requests.service");
const {
  createAssemblyRecordRequestFixture,
  removeAssemblyRecordRequestFixture,
} = require("../assembly-record-requests.test-utils");

describe("assembly-record-requests service", () => {
  let fixture;
  let createdIds;

  beforeEach(async () => {
    createdIds = [];
    fixture = await createAssemblyRecordRequestFixture({
      description: `Service fixture ${Date.now()}`,
      attachments: [{ type: "CertPosesion" }, { type: "PlanoMemoria" }],
      legacyPayload: { typeUser: "comunero" },
    });
  });

  afterEach(async () => {
    await Promise.all(createdIds.map((id) => removeAssemblyRecordRequestFixture(id)));
    await removeAssemblyRecordRequestFixture(fixture?.id);
  });

  it("lists requests with pagination using real DB data", async () => {
    const result = await assemblyService.listAssemblyRecordRequests({ search: fixture.description, page: 1, limit: 10 });

    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.docs.some((item) => item.code === fixture.code)).toBe(true);
  });

  it("returns a request by id", async () => {
    await expect(assemblyService.getAssemblyRecordRequestById(fixture.id)).resolves.toMatchObject({
      _id: fixture.code,
      code: fixture.code,
      clientId: fixture.clientId,
      certificateId: fixture.certificateId,
      userId: fixture.userId,
      status: "En Proceso",
    });
  });

  it("throws when a request by id is missing", async () => {
    await expect(assemblyService.getAssemblyRecordRequestById(99999999)).rejects.toMatchObject(
      new HttpError(404, "Solicitud de acta no encontrada")
    );
  });

  it("returns a deletion preview", async () => {
    await expect(assemblyService.getAssemblyRecordRequestDeletePreview(fixture.id)).resolves.toMatchObject({
      entityLabel: "solicitud de acta",
      itemName: fixture.code,
      canDelete: true,
    });
  });

  it("creates a request in the real DB", async () => {
    const created = await assemblyService.createAssemblyRecordRequest(
      {
        certificateId: fixture.certificateId,
        clientId: fixture.clientId,
        description: `Created ${Date.now()}`,
        buyerFullName: fixture.client.fullName,
        sellerFullName: "Vendedor de prueba",
        sectorLocation: fixture.certificate.sector.name,
        terrainType: fixture.certificate.terrainType.name,
        attachments: [{ type: "CertPosesion" }],
        legacyPayload: { typeUser: "comunero" },
      },
      fixture.userId
    );

    createdIds.push(created.id);

    expect(created).toMatchObject({
      clientId: fixture.clientId,
      certificateId: fixture.certificateId,
      userId: fixture.userId,
      status: "En Proceso",
    });

    const historyRows = await prisma.documentStatusHistory.findMany({
      where: {
        documentType: DOCUMENT_TYPES.ASSEMBLY_RECORD_REQUEST,
        documentId: created.id,
      },
    });

    expect(historyRows.some((row) => row.status === "EnProceso")).toBe(true);
  });

  it("rejects invalid certificate ids on create", async () => {
    await expect(assemblyService.createAssemblyRecordRequest({ certificateId: "abc" }, fixture.userId)).rejects.toMatchObject(
      new HttpError(400, "certificateId inválido")
    );
  });

  it("rejects create when the certificate is missing", async () => {
    await expect(
      assemblyService.createAssemblyRecordRequest({ certificateId: 99999999, clientId: fixture.clientId }, fixture.userId)
    ).rejects.toMatchObject(new HttpError(400, "Debe existir un certificado previo para crear la solicitud"));
  });

  it("rejects create when the client does not match", async () => {
    await expect(
      assemblyService.createAssemblyRecordRequest({
        certificateId: fixture.certificateId,
        clientId: fixture.clientId + 999,
      }, fixture.userId)
    ).rejects.toMatchObject(new HttpError(400, "El cliente no coincide con el certificado seleccionado"));
  });

  it("updates a request and records status history when status changes", async () => {
    const updated = await assemblyService.updateAssemblyRecordRequest(
      fixture.id,
      { status: "PorRecoger", description: `Updated ${Date.now()}` },
      fixture.userId
    );

    expect(updated).toMatchObject({
      code: fixture.code,
      status: "Por Recoger",
      description: expect.stringContaining("Updated"),
    });

    const historyRows = await prisma.documentStatusHistory.findMany({
      where: {
        documentType: DOCUMENT_TYPES.ASSEMBLY_RECORD_REQUEST,
        documentId: fixture.id,
      },
    });

    expect(historyRows.some((row) => row.status === "PorRecoger")).toBe(true);
  });

  it("throws when updating a missing request", async () => {
    await expect(assemblyService.updateAssemblyRecordRequest(99999999, {}, fixture.userId)).rejects.toMatchObject(
      new HttpError(404, "Solicitud de acta no encontrada")
    );
  });

  it("throws when update receives an invalid certificate id", async () => {
    await expect(
      assemblyService.updateAssemblyRecordRequest(fixture.id, { certificateId: "abc" }, fixture.userId)
    ).rejects.toMatchObject(new HttpError(400, "certificateId inválido"));
  });

  it("throws when update receives an invalid status", async () => {
    await expect(
      assemblyService.updateAssemblyRecordRequest(fixture.id, { status: "INVALID" }, fixture.userId)
    ).rejects.toMatchObject(new HttpError(400, "Estado de solicitud de acta invalido"));
  });

  it("rejects delete preview when missing", async () => {
    await expect(assemblyService.getAssemblyRecordRequestDeletePreview(99999999)).rejects.toMatchObject(
      new HttpError(404, "Solicitud de acta no encontrada")
    );
  });

  it("deletes a request after previewing it", async () => {
    const temp = await createAssemblyRecordRequestFixture({
      description: `Delete fixture ${Date.now()}`,
      attachments: [{ type: "CertPosesion" }],
      legacyPayload: { typeUser: "comunero" },
    });
    createdIds.push(temp.id);

    await expect(assemblyService.deleteAssemblyRecordRequest(temp.id)).resolves.toBeUndefined();

    const found = await prisma.assemblyRecordRequest.findUnique({ where: { id: temp.id } });
    expect(found).toBeNull();
  });

  it("returns a request by code", async () => {
    await expect(assemblyService.getAssemblyRecordRequestByCode(fixture.code)).resolves.toMatchObject({
      code: fixture.code,
      _id: fixture.code,
    });
  });
});
