const prisma = require("../../../src/config/prisma");
const clientsService = require("../../../src/api/clients/services/clients.service");
const { syncSerialSequences } = require("../../integration-test-utils");

const uniqueValue = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

describe("clients service", () => {
  let fixture;

  beforeAll(async () => {
    await syncSerialSequences(["Client", "Commoner"]);
  });

  beforeEach(async () => {
    fixture = await clientsService.createClient({
      fullName: `Cliente IT ${uniqueValue("base")}`,
      documentNumber: uniqueValue("DOC"),
      address: "Direccion de prueba",
      phone: "999999999",
      isComunero: false,
      noDocument: false,
    }, "Admin");
  });

  afterEach(async () => {
    if (!fixture) return;

    await prisma.client.deleteMany({ where: { id: fixture.id } });
  });

  it("lists clients", async () => {
    const result = await clientsService.listClients({ page: 1, limit: 10 });
    expect(result.docs.some((client) => client.id === fixture.id)).toBe(true);
  });

  it("gets a client by id", async () => {
    await expect(clientsService.getClientById(fixture.id)).resolves.toMatchObject({
      id: fixture.id,
      fullName: fixture.fullName,
    });
  });

  it("searches by document", async () => {
    await expect(clientsService.searchByDocument(fixture.documentNumber)).resolves.toMatchObject({
      id: fixture.id,
      documentNumber: fixture.documentNumber,
    });
  });

  it("updates and deletes a client", async () => {
    const updated = await clientsService.updateClient(fixture.id, {
      fullName: `${fixture.fullName} Actualizado`,
      documentNumber: fixture.documentNumber,
      isComunero: false,
      noDocument: false,
    }, "Admin");

    expect(updated.fullName).toContain("Actualizado");

    const preview = await clientsService.getClientDeletePreview(fixture.id);
    expect(preview.canDelete).toBe(true);

    await clientsService.deleteClient(fixture.id);
    const found = await prisma.client.findUnique({ where: { id: fixture.id } });
    expect(found).toBeNull();
    fixture = null;
  });

  it("creates a client with a unique document", async () => {
    const created = await clientsService.createClient({
      fullName: `Cliente nuevo ${uniqueValue("create")}`,
      documentNumber: uniqueValue("NEWDOC"),
      isComunero: false,
      noDocument: false,
    }, "Admin");

    try {
      expect(created.fullName).toContain("Cliente nuevo");
    } finally {
      await prisma.client.deleteMany({ where: { id: created.id } });
    }
  });

  it("upserts a client by document", async () => {
    const updated = await clientsService.upsertClientByDocument(fixture.documentNumber, {
      fullName: `${fixture.fullName} Actualizado`,
      isComunero: false,
      noDocument: false,
    });

    expect(updated.fullName).toContain("Actualizado");
  });
});
