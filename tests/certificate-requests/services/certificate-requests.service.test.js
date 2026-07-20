const prisma = require("../../../src/config/prisma");
const HttpError = require("../../../src/utils/http-error");
const certificateRequestsService = require("../../../src/api/certificate-requests/services/certificate-requests.service");
const { DOCUMENT_TYPES } = require("../../../src/utils/document-status-history.utils");
const {
  createCertificateRequestFixture,
  removeCertificateRequestFixture,
} = require("../certificate-requests.test-utils");
const uniqueDocNumber = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

describe("certificate-requests service", () => {
  let fixture;
  const created = [];

  beforeEach(async () => {
    fixture = await createCertificateRequestFixture({
      requestNumber: `IT-CR-SVC-${Date.now()}`,
      description: `Service fixture ${Date.now()}`,
      requestDescription: `Service detail ${Date.now()}`,
      destination: "Secretaria",
      certificateTypes: [{ type: "CertificadoPosesion" }],
      attachments: [{ type: "CopiaDni" }],
    });
  });

  afterEach(async () => {
    for (const item of created.splice(0)) {
      await removeCertificateRequestFixture(item);
    }

    await removeCertificateRequestFixture(fixture);
  });

  it("lists requests with pagination using real DB data", async () => {
    const result = await certificateRequestsService.listCertificateRequests({
      search: fixture.request.requestNumber,
      page: 1,
      limit: 10,
    });

    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.docs.some((item) => item.requestNumber === fixture.request.requestNumber)).toBe(true);
  });

  it("returns a request by id", async () => {
    await expect(certificateRequestsService.getCertificateRequestById(String(fixture.request.id))).resolves.toMatchObject({
      id: fixture.request.id,
      requestNumber: fixture.request.requestNumber,
      client: {
        id: fixture.client.id,
      },
    });
  });

  it("returns a request by request number", async () => {
    await expect(certificateRequestsService.getCertificateRequestById(fixture.request.requestNumber)).resolves.toMatchObject({
      id: fixture.request.id,
      requestNumber: fixture.request.requestNumber,
    });
  });

  it("throws when a request is missing", async () => {
    await expect(certificateRequestsService.getCertificateRequestById("missing-request")).rejects.toMatchObject(
      new HttpError(404, "Solicitud de certificado no encontrada")
    );
  });

  it("returns a deletion preview", async () => {
    await expect(certificateRequestsService.getCertificateRequestDeletePreview(fixture.request.id)).resolves.toMatchObject({
      entityLabel: "solicitud de certificado",
      itemName: fixture.request.requestNumber,
      canDelete: true,
    });
  });

  it("creates a certificate request in the real DB", async () => {
    const createdRequest = await certificateRequestsService.createCertificateRequest(
      {
        client: {
          fullName: fixture.client.fullName,
          documentNumber: fixture.client.documentNumber,
        },
        destination: "Secretaria",
        requestDescription: "Solicitud creada por test",
        sectorLocation: "Sector prueba",
        certificateTypes: [{ type: "CertificadoPosesion" }],
        attachments: [{ type: "CopiaDni" }],
        isComunero: false,
      },
      fixture.authUser.id
    );

    created.push({
      request: {
        id: createdRequest.id,
        clientId: createdRequest.client.id,
        partnerId: createdRequest.partnerClient?.id || null,
      },
      client: { id: createdRequest.client.id },
      partner: createdRequest.partnerClient?.id ? { id: createdRequest.partnerClient.id } : null,
    });

    expect(createdRequest).toMatchObject({
      requestNumber: expect.stringMatching(/^\d{6}-\d{2}$/),
      client: { id: expect.any(Number) },
      status: "Recepcionado",
    });

    const historyRows = await prisma.documentStatusHistory.findMany({
      where: {
        documentType: DOCUMENT_TYPES.CERTIFICATE_REQUEST,
        documentId: createdRequest.id,
      },
    });

    expect(historyRows.some((row) => row.status === "Recepcionado")).toBe(true);
  });

  it("rejects create when client data is missing", async () => {
    await expect(
      certificateRequestsService.createCertificateRequest({ client: { fullName: "", documentNumber: uniqueDocNumber("IT-CR-ERR") } }, fixture.authUser.id)
    ).rejects.toMatchObject(new HttpError(400, "client.fullName y client.documentNumber son obligatorios"));
  });

  it("rejects create when the authenticated user is missing", async () => {
    await expect(
      certificateRequestsService.createCertificateRequest({
        client: { fullName: "Cliente", documentNumber: uniqueDocNumber("IT-CR-ERR") },
      }, 99999999)
    ).rejects.toMatchObject(new HttpError(401, "El usuario autenticado no existe o ya no esta disponible"));
  });

  it("updates a request and records observation note", async () => {
    const updated = await certificateRequestsService.updateCertificateRequest(
      fixture.request.id,
      { status: "Observado", note: "Falta documento" },
      fixture.authUser.id
    );

    expect(updated).toMatchObject({
      id: fixture.request.id,
      requestNumber: fixture.request.requestNumber,
      status: "Observado",
      statusNote: "Falta documento",
    });
  });

  it("throws when updating a missing request", async () => {
    await expect(
      certificateRequestsService.updateCertificateRequest(99999999, { status: "PorFirmar" }, fixture.authUser.id)
    ).rejects.toMatchObject(new HttpError(404, "Solicitud de certificado no encontrada"));
  });

  it("throws when status is invalid", async () => {
    await expect(
      certificateRequestsService.updateCertificateRequest(fixture.request.id, { status: "INVALID" }, fixture.authUser.id)
    ).rejects.toMatchObject(new HttpError(400, "Estado de solicitud de certificado invalido"));
  });

  it("requires a note when status is Observado", async () => {
    await expect(
      certificateRequestsService.updateCertificateRequest(fixture.request.id, { status: "Observado" }, fixture.authUser.id)
    ).rejects.toMatchObject(new HttpError(400, "La razón es obligatoria cuando el estado es Observado"));
  });

  it("deletes a request after previewing it", async () => {
    const temp = await createCertificateRequestFixture({
      requestNumber: `IT-CR-DEL-${Date.now()}`,
      destination: "Secretaria",
      certificateTypes: [{ type: "CertificadoPosesion" }],
      attachments: [{ type: "CopiaDni" }],
    });

    await expect(certificateRequestsService.deleteCertificateRequest(temp.request.id)).resolves.toBeUndefined();

    const found = await prisma.certificateRequest.findUnique({ where: { id: temp.request.id } });
    expect(found).toBeNull();

    await removeCertificateRequestFixture(temp);
  });
});
