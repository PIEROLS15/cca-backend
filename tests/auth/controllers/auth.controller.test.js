const request = require("supertest");
const app = require("../../../src/app");
const { refreshAuthUser, createAuthUserFixture, removeAuthUserFixture, makeAuthToken } = require("../auth.test-utils");

describe("auth controller", () => {
  let fixture;
  let token;

  beforeEach(async () => {
    fixture = await createAuthUserFixture({
      username: `controller-${Date.now()}`,
      fullName: "Auth Controller User",
      email: `controller-${Date.now()}@example.com`,
      dni: `${Date.now()}`.slice(-8),
      password: "Secret123!",
    });

    token = makeAuthToken(fixture.user);
  });

  afterEach(async () => {
    await removeAuthUserFixture(fixture?.user?.id);
  });

  it("login responde con cookie y usuario", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: fixture.user.username, password: fixture.password });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: fixture.user.id, username: fixture.user.username });
    expect(res.headers["set-cookie"].join(";")).toContain("token=");
  });

  it("login rechaza credenciales incompletas", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: fixture.user.username });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("username y password son obligatorios");
  });

  it("login rechaza credenciales invalidas", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: fixture.user.username, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Credenciales invalidas");
  });

  it("me responde el usuario autenticado", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: fixture.user.id, username: fixture.user.username });
  });

  it("logout limpia la cookie de token", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Sesión cerrada correctamente");
    expect(Array.isArray(res.headers["set-cookie"])).toBe(true);
  });

  it("updateProfile normaliza los campos y responde el usuario", async () => {
    const payload = {
      fullName: `  ${fixture.user.fullName}  `,
      username: `  ${fixture.user.username}-upd  `,
      email: `  ${fixture.user.username}-upd@example.com  `,
      dni: ` ${Number(fixture.user.dni || 0) + 1} `,
    };

    const res = await request(app)
      .patch("/api/auth/profile")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: fixture.user.id,
      username: `${fixture.user.username}-upd`,
      fullName: fixture.user.fullName,
      email: `${fixture.user.username}-upd@example.com`,
    });

    const updated = await refreshAuthUser(fixture.user.id);
    expect(updated).toMatchObject({
      username: `${fixture.user.username}-upd`,
      email: `${fixture.user.username}-upd@example.com`,
    });
  });

  it("updateProfile rechaza campos obligatorios faltantes", async () => {
    const res = await request(app)
      .patch("/api/auth/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: "only-username" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("fullName y username son obligatorios");
  });

  it("changePassword actualiza la contraseña", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: fixture.password, newPassword: "NewSecret123!" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Contraseña actualizada correctamente");

    const verify = await request(app)
      .post("/api/auth/verify-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "NewSecret123!" });

    expect(verify.status).toBe(200);
    expect(verify.body.message).toBe("Contraseña verificada correctamente");
  });

  it("changePassword rechaza contraseñas nuevas cortas", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: fixture.password, newPassword: "12345" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("La nueva contraseña debe tener al menos 6 caracteres");
  });

  it("verifyPassword confirma la contraseña", async () => {
    const res = await request(app)
      .post("/api/auth/verify-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: fixture.password });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Contraseña verificada correctamente");
  });

  it("verifyPassword rechaza el campo password faltante", async () => {
    const res = await request(app)
      .post("/api/auth/verify-password")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("password es obligatorio");
  });
});
