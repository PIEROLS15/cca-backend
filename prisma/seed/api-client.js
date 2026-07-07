const DEFAULT_USERNAME = process.env.SEED_LOGIN_USERNAME || "pierols";
const DEFAULT_PASSWORD = process.env.SEED_LOGIN_PASSWORD || "123456";

const getApiBaseUrl = () => {
  const rawBaseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.BACKEND_PORT || 9001}`;
  return String(rawBaseUrl).replace(/\/+$/, "");
};

const buildApiUrl = (path, query = {}) => {
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith("/api/") && baseUrl.endsWith("/api")
    ? path.slice(4)
    : path;
  const url = new URL(normalizedPath.startsWith("http") ? normalizedPath : `${baseUrl}${normalizedPath.startsWith("/") ? "" : "/"}${normalizedPath}`);

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url;
};

const extractTokenFromCookie = (setCookieHeader) => {
  if (!setCookieHeader) {
    return null;
  }

  const cookieText = Array.isArray(setCookieHeader) ? setCookieHeader.join(";") : String(setCookieHeader);
  const match = cookieText.match(/(?:^|[,;]\s*)token=([^;]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
};

const readResponseBody = async (res) => {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return res.json();
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const createSeedApiClient = async ({ username = DEFAULT_USERNAME, password = DEFAULT_PASSWORD } = {}) => {
  const loginResponse = await fetch(buildApiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!loginResponse.ok) {
    const body = await loginResponse.text().catch(() => "");
    throw new Error(`No se pudo autenticar en la API${body ? `: ${body.slice(0, 200)}` : ""}`);
  }

  const setCookieHeader = typeof loginResponse.headers.getSetCookie === "function"
    ? loginResponse.headers.getSetCookie()
    : loginResponse.headers.get("set-cookie");
  const token = extractTokenFromCookie(setCookieHeader);
  if (!token) {
    throw new Error("No se pudo obtener el token de autenticacion desde la cookie de login");
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  const request = async (path, { method = "GET", query = {}, body, headers = {} } = {}) => {
    const response = await fetch(buildApiUrl(path, query), {
      method,
      headers: {
        ...authHeaders,
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });

    const payload = await readResponseBody(response);
    if (!response.ok) {
      const message = typeof payload === "string"
        ? payload
        : payload?.message || payload?.error || `HTTP ${response.status}`;
      throw new Error(message);
    }

    return payload;
  };

  const listAll = async (path, { query = {}, limit = 100 } = {}) => {
    const items = [];
    let page = 1;
    let totalPages = 1;

    do {
      const payload = await request(path, { query: { ...query, page, limit } });
      const pageItems = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.data?.docs)
          ? payload.data.docs
          : [];

      items.push(...pageItems);
      totalPages = Number(payload?.totalPages || payload?.data?.totalPages || 1);
      page += 1;
    } while (page <= totalPages);

    return items;
  };

  return {
    token,
    request,
    listAll,
  };
};

module.exports = {
  buildApiUrl,
  createSeedApiClient,
  extractTokenFromCookie,
};
