const authService = require("../../../src/api/auth/services/auth.service");
const authController = require("../../../src/api/auth/controllers/auth.controller");

const flush = () => new Promise((resolve) => setImmediate(resolve));

const createRes = () => ({
  cookie: vi.fn(),
  clearCookie: vi.fn(),
  json: vi.fn(),
});

describe("auth controller", () => {
  beforeEach(() => {
    authService.login = vi.fn();
    authService.me = vi.fn();
    authService.updateProfile = vi.fn();
    authService.changePassword = vi.fn();
    authService.verifyPassword = vi.fn();
  });

  it("login responde con cookie y usuario", async () => {
    const req = { body: { username: "admin", password: "secret" } };
    const res = createRes();
    const next = vi.fn();

    authService.login.mockResolvedValue({ token: "token-123", user: { id: 1, username: "admin" } });

    authController.login(req, res, next);
    await flush();

    expect(authService.login).toHaveBeenCalledWith({ username: "admin", password: "secret" });
    expect(res.cookie).toHaveBeenCalledWith(
      "token",
      "token-123",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" })
    );
    expect(res.json).toHaveBeenCalledWith({ user: { id: 1, username: "admin" } });
    expect(next).not.toHaveBeenCalled();
  });

  it("login rechaza credenciales incompletas", async () => {
    const req = { body: { username: "admin" } };
    const res = createRes();
    const next = vi.fn();

    authController.login(req, res, next);
    await flush();

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: "username y password son obligatorios" }));
    expect(authService.login).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("me responde el usuario autenticado", async () => {
    const req = { user: { sub: 7 } };
    const res = createRes();
    const next = vi.fn();

    authService.me.mockResolvedValue({ id: 7, username: "admin" });

    authController.me(req, res, next);
    await flush();

    expect(authService.me).toHaveBeenCalledWith(7);
    expect(res.json).toHaveBeenCalledWith({ user: { id: 7, username: "admin" } });
    expect(next).not.toHaveBeenCalled();
  });

  it("logout limpia la cookie de token", async () => {
    const req = { user: { sub: 7 } };
    const res = createRes();
    const next = vi.fn();

    authController.logout(req, res, next);
    await flush();

    expect(res.clearCookie).toHaveBeenNthCalledWith(
      1,
      "token",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" })
    );
    expect(res.clearCookie).toHaveBeenNthCalledWith(
      2,
      "token",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" })
    );
    expect(res.json).toHaveBeenCalledWith({ message: "Sesión cerrada correctamente" });
    expect(next).not.toHaveBeenCalled();
  });

  it("updateProfile normaliza los campos y responde el usuario", async () => {
    const req = {
      user: { sub: 9 },
      body: {
        fullName: "  Juan Perez  ",
        username: "  jperez  ",
        email: "  juan@correo.com  ",
        dni: " 12345678 ",
      },
    };
    const res = createRes();
    const next = vi.fn();

    authService.updateProfile.mockResolvedValue({ id: 9, username: "jperez" });

    authController.updateProfile(req, res, next);
    await flush();

    expect(authService.updateProfile).toHaveBeenCalledWith(9, {
      fullName: "Juan Perez",
      username: "jperez",
      email: "juan@correo.com",
      dni: "12345678",
    });
    expect(res.json).toHaveBeenCalledWith({ user: { id: 9, username: "jperez" } });
    expect(next).not.toHaveBeenCalled();
  });

  it("updateProfile rechaza campos obligatorios faltantes", async () => {
    const req = { user: { sub: 9 }, body: { username: "jperez" } };
    const res = createRes();
    const next = vi.fn();

    authController.updateProfile(req, res, next);
    await flush();

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: "fullName y username son obligatorios" }));
    expect(authService.updateProfile).not.toHaveBeenCalled();
  });

  it("changePassword actualiza la contraseña", async () => {
    const req = { user: { sub: 11 }, body: { currentPassword: "oldpass", newPassword: "newpass" } };
    const res = createRes();
    const next = vi.fn();

    authController.changePassword(req, res, next);
    await flush();

    expect(authService.changePassword).toHaveBeenCalledWith(11, { currentPassword: "oldpass", newPassword: "newpass" });
    expect(res.json).toHaveBeenCalledWith({ message: "Contraseña actualizada correctamente" });
    expect(next).not.toHaveBeenCalled();
  });

  it("changePassword rechaza contraseñas nuevas cortas", async () => {
    const req = { user: { sub: 11 }, body: { currentPassword: "oldpass", newPassword: "12345" } };
    const res = createRes();
    const next = vi.fn();

    authController.changePassword(req, res, next);
    await flush();

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: "La nueva contraseña debe tener al menos 6 caracteres" }));
    expect(authService.changePassword).not.toHaveBeenCalled();
  });

  it("verifyPassword confirma la contraseña", async () => {
    const req = { user: { sub: 13 }, body: { password: "secret" } };
    const res = createRes();
    const next = vi.fn();

    authController.verifyPassword(req, res, next);
    await flush();

    expect(authService.verifyPassword).toHaveBeenCalledWith(13, "secret");
    expect(res.json).toHaveBeenCalledWith({ message: "Contraseña verificada correctamente" });
    expect(next).not.toHaveBeenCalled();
  });

  it("verifyPassword rechaza el campo password faltante", async () => {
    const req = { user: { sub: 13 }, body: {} };
    const res = createRes();
    const next = vi.fn();

    authController.verifyPassword(req, res, next);
    await flush();

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: "password es obligatorio" }));
    expect(authService.verifyPassword).not.toHaveBeenCalled();
  });
});
