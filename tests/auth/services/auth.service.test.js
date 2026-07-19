const bcrypt = require("bcryptjs");
const prisma = require("../../../src/config/prisma");
const HttpError = require("../../../src/utils/http-error");
const authUtils = require("../../../src/api/auth/utils/auth.utils");
const authService = require("../../../src/api/auth/services/auth.service");

const sampleUser = {
  id: 1,
  username: "admin",
  password: "hashed-password",
  fullName: "Admin User",
  email: "admin@example.com",
  dni: "12345678",
  isActive: true,
  role: {
    id: 2,
    name: "Admin",
    description: "Acceso total",
    rolePermissions: [{ permission: { key: "users.read" } }],
  },
};

const sanitizedUser = { id: 1, username: "admin" };

describe("auth service", () => {
  beforeEach(() => {
    prisma.user.findUnique = vi.fn();
    prisma.user.findFirst = vi.fn();
    prisma.user.update = vi.fn();
    bcrypt.compare = vi.fn();
    bcrypt.hash = vi.fn();
  });

  describe("me", () => {
    it("returns the sanitized user", async () => {
      prisma.user.findUnique.mockResolvedValue(sampleUser);

      await expect(authService.me(1)).resolves.toEqual(authUtils.sanitizeUser(sampleUser));

      expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 } }));
    });

    it("throws when the user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.me(1)).rejects.toMatchObject(new HttpError(401, "Usuario no encontrado"));
    });

    it("throws when the user is inactive", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...sampleUser, isActive: false });

      await expect(authService.me(1)).rejects.toMatchObject(new HttpError(403, "Usuario inactivo"));
    });
  });

  describe("login", () => {
    it("returns a token and sanitized user on valid credentials", async () => {
      prisma.user.findUnique.mockResolvedValue(sampleUser);
      bcrypt.compare.mockResolvedValue(true);

      await expect(authService.login({ username: "admin", password: "secret" })).resolves.toEqual({
        token: expect.any(String),
        user: authUtils.sanitizeUser(sampleUser),
      });

      expect(bcrypt.compare).toHaveBeenCalledWith("secret", sampleUser.password);
    });

    it("throws when the username does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.login({ username: "admin", password: "secret" })).rejects.toMatchObject(
        new HttpError(401, "Credenciales invalidas")
      );
    });

    it("throws when the password is invalid", async () => {
      prisma.user.findUnique.mockResolvedValue(sampleUser);
      bcrypt.compare.mockResolvedValue(false);

      await expect(authService.login({ username: "admin", password: "wrong" })).rejects.toMatchObject(
        new HttpError(401, "Credenciales invalidas")
      );
    });

    it("throws when the user is inactive", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...sampleUser, isActive: false });
      bcrypt.compare.mockResolvedValue(true);

      await expect(authService.login({ username: "admin", password: "secret" })).rejects.toMatchObject(
        new HttpError(403, "Usuario inactivo")
      );
    });
  });

  describe("updateProfile", () => {
    it("updates the profile and returns the sanitized user", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(sampleUser);
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.user.findFirst.mockResolvedValueOnce(null);
      prisma.user.findFirst.mockResolvedValueOnce(null);
      const updatedUser = { ...sampleUser, username: "jperez", fullName: "Juan Perez", email: "juan@example.com", dni: "87654321" };
      prisma.user.update.mockResolvedValue(updatedUser);

      await expect(
        authService.updateProfile(1, {
          fullName: "Juan Perez",
          username: "jperez",
          email: "juan@example.com",
          dni: "87654321",
        })
      ).resolves.toEqual(authUtils.sanitizeUser(updatedUser));

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          fullName: "Juan Perez",
          username: "jperez",
          email: "juan@example.com",
          dni: "87654321",
        },
        include: expect.any(Object),
      });
    });

    it("throws when the user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        authService.updateProfile(1, { fullName: "Juan Perez", username: "jperez" })
      ).rejects.toMatchObject(new HttpError(404, "Usuario no encontrado"));
    });

    it("throws when the username already exists", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(sampleUser);
      prisma.user.findUnique.mockResolvedValueOnce({ id: 2 });

      await expect(
        authService.updateProfile(1, { fullName: "Juan Perez", username: "jperez" })
      ).rejects.toMatchObject(new HttpError(409, "El nombre de usuario ya existe"));
    });

    it("throws when the email is already in use", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(sampleUser);
      prisma.user.findFirst.mockResolvedValue({ id: 2 });

      await expect(
        authService.updateProfile(1, { fullName: "Juan Perez", username: "admin", email: "juan@example.com" })
      ).rejects.toMatchObject(new HttpError(409, "El email ya esta en uso"));
    });

    it("throws when the DNI is already in use", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(sampleUser);
      prisma.user.findFirst.mockResolvedValueOnce({ id: 3 });

      await expect(
        authService.updateProfile(1, { fullName: "Juan Perez", username: "admin", dni: "87654321" })
      ).rejects.toMatchObject(new HttpError(409, "El DNI ya esta en uso"));
    });
  });

  describe("changePassword", () => {
    it("updates the password when the current password is valid", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, password: "hashed-password" });
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue("new-hash");
      prisma.user.update.mockResolvedValue({});

      await expect(
        authService.changePassword(1, { currentPassword: "secret", newPassword: "newsecret" })
      ).resolves.toBeUndefined();

      expect(bcrypt.hash).toHaveBeenCalledWith("newsecret", 10);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { password: "new-hash" },
      });
    });

    it("throws when the user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.changePassword(1, { currentPassword: "secret", newPassword: "newsecret" })
      ).rejects.toMatchObject(new HttpError(404, "Usuario no encontrado"));
    });

    it("throws when the current password is invalid", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, password: "hashed-password" });
      bcrypt.compare.mockResolvedValue(false);

      await expect(
        authService.changePassword(1, { currentPassword: "wrong", newPassword: "newsecret" })
      ).rejects.toMatchObject(new HttpError(400, "La contraseña actual no es correcta"));
    });
  });

  describe("verifyPassword", () => {
    it("resolves when the password is valid", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, password: "hashed-password" });
      bcrypt.compare.mockResolvedValue(true);

      await expect(authService.verifyPassword(1, "secret")).resolves.toBeUndefined();
      expect(bcrypt.compare).toHaveBeenCalledWith("secret", "hashed-password");
    });

    it("throws when the user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.verifyPassword(1, "secret")).rejects.toMatchObject(new HttpError(404, "Usuario no encontrado"));
    });

    it("throws when the password is invalid", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, password: "hashed-password" });
      bcrypt.compare.mockResolvedValue(false);

      await expect(authService.verifyPassword(1, "wrong")).rejects.toMatchObject(
        new HttpError(400, "La contraseña actual no es correcta")
      );
    });
  });
});
