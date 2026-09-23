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

  it("normalizes current CODART response data", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          first_name: "WILLIAM ROBERT",
          first_last_name: "TACILLA",
          second_last_name: "LLANOS",
          full_name: "WILLIAM ROBERT TACILLA LLANOS",
          document_number: "40355297",
          extras: {
            domicilio: {
              direccion: "ASENT.H. ROSARIO DE ASIA MZ. I LT. 02",
            },
          },
        },
      }),
    });

    await expect(reniecService.searchByDocument("40355297")).resolves.toEqual({
      fullName: "William Robert Tacilla Llanos",
      documentNumber: "40355297",
      address: "ASENT.H. ROSARIO DE ASIA MZ. I LT. 02",
    });
  });
});
