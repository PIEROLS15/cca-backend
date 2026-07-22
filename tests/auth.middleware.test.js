const jwt = require("jsonwebtoken");
const { authRequired } = require("../src/middlewares/auth.middleware");

describe("auth middleware", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  it("rejects requests without token", () => {
    const req = { headers: {}, cookies: {} };
    const next = vi.fn();

    authRequired(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401, message: "Token no proporcionado" }));
  });

  it("accepts bearer tokens", () => {
    const token = jwt.sign({ sub: 1, role: "Admin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
    const next = vi.fn();

    authRequired(req, {}, next);

    expect(req.user).toMatchObject({ sub: 1, role: "Admin" });
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects invalid tokens", () => {
    const req = { headers: { authorization: "Bearer invalid" }, cookies: {} };
    const next = vi.fn();

    authRequired(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401, message: "Token invalido o expirado" }));
  });
});
