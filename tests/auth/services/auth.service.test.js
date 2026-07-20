const bcrypt = require("bcryptjs");
const prisma = require("../../../src/config/prisma");
const HttpError = require("../../../src/utils/http-error");
const authService = require("../../../src/api/auth/services/auth.service");
const { createAuthUserFixture, removeAuthUserFixture, refreshAuthUser } = require("../auth.test-utils");

describe("auth service", () => {
  let fixture;
  const extraIds = [];

  beforeEach(async () => {
    fixture = await createAuthUserFixture({
      username: `service-${Date.now()}`,
      fullName: "Auth Service User",
      email: `service-${Date.now()}@example.com`,
      dni: `${Date.now()}`.slice(-8),
      password: "Secret123!",
      certificateRangeStart: 10,
      certificateRangeEnd: 20,
      lastCertificate: 12,
    });
  });

  afterEach(async () => {
    for (const id of extraIds.splice(0)) {
      await removeAuthUserFixture(id);
    }

    await removeAuthUserFixture(fixture?.user?.id);
  });

  describe("me", () => {
    it("returns the sanitized user", async () => {
      await expect(authService.me(fixture.user.id)).resolves.toMatchObject({
        id: fixture.user.id,
        username: fixture.user.username,
        fullName: fixture.user.fullName,
        email: fixture.user.email,
        role: {
          id: fixture.user.role.id,
          name: fixture.user.role.name,
        },
      });
    });

    it("throws when the user does not exist", async () => {
      await expect(authService.me(99999999)).rejects.toMatchObject(new HttpError(401, "Usuario no encontrado"));
    });

    it("throws when the user is inactive", async () => {
      await prisma.user.update({ where: { id: fixture.user.id }, data: { isActive: false } });

      await expect(authService.me(fixture.user.id)).rejects.toMatchObject(new HttpError(403, "Usuario inactivo"));
    });
  });

  describe("login", () => {
    it("returns a token and sanitized user on valid credentials", async () => {
      await expect(authService.login({ username: fixture.user.username, password: fixture.password })).resolves.toMatchObject({
        token: expect.any(String),
        user: {
          id: fixture.user.id,
          username: fixture.user.username,
        },
      });
    });

    it("throws when the username does not exist", async () => {
      await expect(authService.login({ username: "missing-user", password: fixture.password })).rejects.toMatchObject(
        new HttpError(401, "Credenciales invalidas")
      );
    });

    it("throws when the password is invalid", async () => {
      await expect(authService.login({ username: fixture.user.username, password: "wrong-password" })).rejects.toMatchObject(
        new HttpError(401, "Credenciales invalidas")
      );
    });

    it("throws when the user is inactive", async () => {
      await prisma.user.update({ where: { id: fixture.user.id }, data: { isActive: false } });

      await expect(authService.login({ username: fixture.user.username, password: fixture.password })).rejects.toMatchObject(
        new HttpError(403, "Usuario inactivo")
      );
    });
  });

  describe("updateProfile", () => {
    it("updates the profile and returns the sanitized user", async () => {
      const updated = await authService.updateProfile(fixture.user.id, {
        fullName: `${fixture.user.fullName} Updated`,
        username: `${fixture.user.username}-upd`,
        email: `${fixture.user.username}-upd@example.com`,
        dni: `${Number(fixture.user.dni || 0) + 1}`,
      });

      expect(updated).toMatchObject({
        id: fixture.user.id,
        username: `${fixture.user.username}-upd`,
        fullName: `${fixture.user.fullName} Updated`,
        email: `${fixture.user.username}-upd@example.com`,
      });

      await expect(refreshAuthUser(fixture.user.id)).resolves.toMatchObject({
        username: `${fixture.user.username}-upd`,
      });
    });

    it("throws when the user does not exist", async () => {
      await expect(
        authService.updateProfile(99999999, { fullName: "Juan Perez", username: "jperez" })
      ).rejects.toMatchObject(new HttpError(404, "Usuario no encontrado"));
    });

    it("throws when the username already exists", async () => {
      const conflict = await createAuthUserFixture({
        username: `service-conflict-${Date.now()}`,
        fullName: "Conflict User",
        email: `conflict-${Date.now()}@example.com`,
        dni: `${Date.now() + 1}`.slice(-8),
        password: "Secret123!",
      });
      extraIds.push(conflict.user.id);

      await expect(
        authService.updateProfile(fixture.user.id, {
          fullName: "Juan Perez",
          username: conflict.user.username,
        })
      ).rejects.toMatchObject(new HttpError(409, "El nombre de usuario ya existe"));
    });

    it("throws when the email is already in use", async () => {
      const conflict = await createAuthUserFixture({
        username: `service-conflict-${Date.now()}`,
        fullName: "Conflict User",
        email: `conflict-email-${Date.now()}@example.com`,
        dni: `${Date.now() + 2}`.slice(-8),
        password: "Secret123!",
      });
      extraIds.push(conflict.user.id);

      await expect(
        authService.updateProfile(fixture.user.id, {
          fullName: "Juan Perez",
          username: fixture.user.username,
          email: conflict.user.email,
        })
      ).rejects.toMatchObject(new HttpError(409, "El email ya esta en uso"));
    });

    it("throws when the DNI is already in use", async () => {
      const conflict = await createAuthUserFixture({
        username: `service-conflict-${Date.now()}`,
        fullName: "Conflict User",
        email: `conflict-dni-${Date.now()}@example.com`,
        dni: `${Date.now() + 3}`.slice(-8),
        password: "Secret123!",
      });
      extraIds.push(conflict.user.id);

      await expect(
        authService.updateProfile(fixture.user.id, {
          fullName: "Juan Perez",
          username: fixture.user.username,
          dni: conflict.user.dni,
        })
      ).rejects.toMatchObject(new HttpError(409, "El DNI ya esta en uso"));
    });
  });

  describe("changePassword", () => {
    it("updates the password when the current password is valid", async () => {
      await expect(
        authService.changePassword(fixture.user.id, { currentPassword: fixture.password, newPassword: "NewSecret123!" })
      ).resolves.toBeUndefined();

      const updated = await prisma.user.findUnique({ where: { id: fixture.user.id }, select: { password: true } });
      await expect(bcrypt.compare("NewSecret123!", updated.password)).resolves.toBe(true);
    });

    it("throws when the user does not exist", async () => {
      await expect(
        authService.changePassword(99999999, { currentPassword: fixture.password, newPassword: "NewSecret123!" })
      ).rejects.toMatchObject(new HttpError(404, "Usuario no encontrado"));
    });

    it("throws when the current password is invalid", async () => {
      await expect(
        authService.changePassword(fixture.user.id, { currentPassword: "wrong-password", newPassword: "NewSecret123!" })
      ).rejects.toMatchObject(new HttpError(400, "La contraseña actual no es correcta"));
    });
  });

  describe("verifyPassword", () => {
    it("resolves when the password is valid", async () => {
      await expect(authService.verifyPassword(fixture.user.id, fixture.password)).resolves.toBeUndefined();
    });

    it("throws when the user does not exist", async () => {
      await expect(authService.verifyPassword(99999999, fixture.password)).rejects.toMatchObject(
        new HttpError(404, "Usuario no encontrado")
      );
    });

    it("throws when the password is invalid", async () => {
      await expect(authService.verifyPassword(fixture.user.id, "wrong-password")).rejects.toMatchObject(
        new HttpError(400, "La contraseña actual no es correcta")
      );
    });
  });
});
