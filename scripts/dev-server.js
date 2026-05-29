const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const frontendRoot = path.join(root, "frontend");
const dataDir = path.join(root, ".dev-data");
fs.mkdirSync(dataDir, { recursive: true });

const common = {
  AUTH_SECRET: process.env.AUTH_SECRET || "local-dev-auth-secret",
  SERVICE_TOKEN: process.env.SERVICE_TOKEN || "local-dev-service-token",
};

const ports = {
  auth: 45001,
  profile: 45002,
  accounts: 45003,
  balancer: 45004,
  notifications: 45005,
  deposits: 45006,
  transfers: 45007,
  analytics: 45008,
  ai: 45009,
  admin: 45010,
  gateway: 45080,
  frontend: 45000,
};

const url = (port) => `http://127.0.0.1:${port}`;

const services = [
  { name: "auth", cwd: "services/auth", port: ports.auth, env: { DATA_FILE: path.join(dataDir, "auth.json") } },
  { name: "profile", cwd: "services/profile", port: ports.profile, env: { DATA_FILE: path.join(dataDir, "profile.json") } },
  { name: "accounts", cwd: "services/accounts", port: ports.accounts, env: { DATA_FILE: path.join(dataDir, "accounts.json") } },
  { name: "balancer", cwd: "services/balancer", port: ports.balancer, env: { ACCOUNTS_SERVICE_URL: url(ports.accounts) } },
  {
    name: "notifications",
    cwd: "services/notifications",
    port: ports.notifications,
    env: { DATA_FILE: path.join(dataDir, "notifications.json") },
  },
  {
    name: "deposits",
    cwd: "services/deposits",
    port: ports.deposits,
    env: {
      DATA_FILE: path.join(dataDir, "deposits.json"),
      ACCOUNTS_SERVICE_URL: url(ports.accounts),
      NOTIFICATIONS_SERVICE_URL: url(ports.notifications),
    },
  },
  {
    name: "transfers",
    cwd: "services/transfers",
    port: ports.transfers,
    env: {
      DATA_FILE: path.join(dataDir, "transfers.json"),
      ACCOUNTS_SERVICE_URL: url(ports.accounts),
      NOTIFICATIONS_SERVICE_URL: url(ports.notifications),
    },
  },
  {
    name: "analytics",
    cwd: "services/analytics",
    port: ports.analytics,
    env: {
      AUTH_SERVICE_URL: url(ports.auth),
      ACCOUNTS_SERVICE_URL: url(ports.accounts),
      DEPOSITS_SERVICE_URL: url(ports.deposits),
      TRANSFERS_SERVICE_URL: url(ports.transfers),
    },
  },
  {
    name: "ai",
    cwd: "services/ai",
    port: ports.ai,
    env: {
      ANALYTICS_SERVICE_URL: url(ports.analytics),
      BALANCER_SERVICE_URL: url(ports.balancer),
    },
  },
  {
    name: "admin",
    cwd: "services/admin",
    port: ports.admin,
    env: {
      AUTH_SERVICE_URL: url(ports.auth),
      PROFILE_SERVICE_URL: url(ports.profile),
      TRANSFERS_SERVICE_URL: url(ports.transfers),
      ANALYTICS_SERVICE_URL: url(ports.analytics),
    },
  },
  {
    name: "gateway",
    cwd: "gateway",
    port: ports.gateway,
    env: {
      AUTH_SERVICE_URL: url(ports.auth),
      PROFILE_SERVICE_URL: url(ports.profile),
      ACCOUNTS_SERVICE_URL: url(ports.accounts),
      BALANCER_SERVICE_URL: url(ports.balancer),
      NOTIFICATIONS_SERVICE_URL: url(ports.notifications),
      DEPOSITS_SERVICE_URL: url(ports.deposits),
      TRANSFERS_SERVICE_URL: url(ports.transfers),
      ANALYTICS_SERVICE_URL: url(ports.analytics),
      AI_SERVICE_URL: url(ports.ai),
      ADMIN_SERVICE_URL: url(ports.admin),
    },
  },
];

const children = services.map((service) => {
  const child = spawn(process.execPath, ["src/index.js"], {
    cwd: path.join(root, service.cwd),
    env: {
      ...process.env,
      ...common,
      ...service.env,
      PORT: String(service.port),
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
  return child;
});

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".jpeg": "image/jpeg",
      ".jpg": "image/jpeg",
      ".webp": "image/webp",
      ".png": "image/png",
    }[ext] || "application/octet-stream"
  );
}

function proxyApi(req, res) {
  const upstream = http.request(
    `${url(ports.gateway)}${req.url}`,
    {
      method: req.method,
      headers: req.headers,
    },
    (apiResponse) => {
      res.writeHead(apiResponse.statusCode || 502, apiResponse.headers);
      apiResponse.pipe(res);
    }
  );
  upstream.on("error", (error) => {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: error.message }));
  });
  req.pipe(upstream);
}

const frontend = http.createServer((req, res) => {
  if (req.url === "/api" || req.url.startsWith("/api/")) {
    proxyApi(req, res);
    return;
  }

  const requestPath = decodeURIComponent(req.url.split("?")[0]);
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(frontendRoot, safePath));

  if (!filePath.startsWith(frontendRoot)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(frontendRoot, "index.html"), (_fallbackError, fallback) => {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(fallback);
      });
      return;
    }

    res.writeHead(200, { "content-type": contentType(filePath) });
    res.end(content);
  });
});

frontend.listen(ports.frontend, () => {
  console.log(`LionTech Finance local frontend http://localhost:${ports.frontend}`);
});

function shutdown() {
  frontend.close();
  for (const child of children) {
    child.kill();
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
