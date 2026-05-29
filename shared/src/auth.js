const crypto = require("crypto");

const DEFAULT_AUTH_SECRET = "liontech-finance-local-secret";
const DEFAULT_SERVICE_TOKEN = "liontech-finance-service-token";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function jsonBase64url(value) {
  return base64url(JSON.stringify(value));
}

function getAuthSecret() {
  return process.env.AUTH_SECRET || DEFAULT_AUTH_SECRET;
}

function getServiceToken() {
  return process.env.SERVICE_TOKEN || DEFAULT_SERVICE_TOKEN;
}

function createPasswordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
  const [salt, expectedHash] = String(passwordHash || "").split(":");

  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = createPasswordHash(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
}

function createToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Number(process.env.TOKEN_TTL_SECONDS || 43200);
  const header = jsonBase64url({ alg: "HS256", typ: "JWT" });
  const payload = jsonBase64url({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role || "customer",
    iat: now,
    exp: now + ttl,
  });
  const signature = crypto.createHmac("sha256", getAuthSecret()).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  const [header, payload, signature] = String(token || "").split(".");

  if (!header || !payload || !signature) {
    return null;
  }

  const expected = crypto.createHmac("sha256", getAuthSecret()).update(`${header}.${payload}`).digest("base64url");

  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

  if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return {
    id: claims.sub,
    email: claims.email,
    name: claims.name,
    role: claims.role || "customer",
  };
}

function bearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
}

function getUser(req) {
  const token = bearerToken(req);
  return token ? verifyToken(token) : null;
}

function requireUser(req) {
  const user = getUser(req);

  if (!user) {
    const error = new Error("Authentication is required.");
    error.status = 401;
    throw error;
  }

  req.user = user;
  return user;
}

function requireAdmin(req) {
  const user = requireUser(req);

  if (user.role !== "admin") {
    const error = new Error("Admin access is required.");
    error.status = 403;
    throw error;
  }

  return user;
}

function requireService(req) {
  const serviceToken = req.headers["x-service-token"];

  if (serviceToken !== getServiceToken()) {
    const error = new Error("Service access is required.");
    error.status = 403;
    throw error;
  }

  req.service = true;
  return true;
}

function getActor(req) {
  const serviceToken = req.headers["x-service-token"];

  if (serviceToken === getServiceToken()) {
    req.service = true;
    return { type: "service", role: "service", id: "service" };
  }

  const user = requireUser(req);
  return { type: "user", ...user };
}

function serviceHeaders(extra = {}) {
  return {
    "content-type": "application/json",
    "x-service-token": getServiceToken(),
    ...extra,
  };
}

module.exports = {
  createPasswordHash,
  createToken,
  getActor,
  getUser,
  requireAdmin,
  requireService,
  requireUser,
  serviceHeaders,
  verifyPassword,
  verifyToken,
};
