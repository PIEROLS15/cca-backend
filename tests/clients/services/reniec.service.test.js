const reniecService = require("../../../src/api/clients/services/reniec.service");

describe("reniec service", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.RENIEC_PROVIDER = "codart";
    process.env.RENIEC_CODART_TOKEN = "token";
    process.env.RENIEC_CODART_URL = "https://reniec.test/";
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("searches by document", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          first_name: "juan",
          first_last_name: "perez",
          second_last_name: "gomez",
          document_number: "12345678",
          address: "data in credit",
        },
      }),
    });

    await expect(reniecService.searchByDocument("12345678")).resolves.toEqual({
      fullName: "Juan Perez Gomez",
      documentNumber: "12345678",
      address: "",
    });
  });
});
