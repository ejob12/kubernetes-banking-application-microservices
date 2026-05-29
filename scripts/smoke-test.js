const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, ".smoke-data", String(Date.now()));
fs.mkdirSync(dataDir, { recursive: true });

const common = {
  AUTH_SECRET: "smoke-auth-secret",
  SERVICE_TOKEN: "smoke-service-token",
};

const ports = {
  auth: 43101,
  profile: 43102,
  accounts: 43103,
  balancer: 43104,
  notifications: 43105,
  deposits: 43106,
  transfers: 43107,
  analytics: 43108,
  ai: 43109,
  admin: 43110,
  gateway: 43180,
};

const url = (port) => `http://127.0.0.1:${port}`;

const services = [
  {
    name: "auth",
    cwd: "services/auth",
    port: ports.auth,
    env: { DATA_FILE: path.join(dataDir, "auth.json") },
  },
  {
    name: "profile",
    cwd: "services/profile",
    port: ports.profile,
    env: { DATA_FILE: path.join(dataDir, "profile.json") },
  },
  {
    name: "accounts",
    cwd: "services/accounts",
    port: ports.accounts,
    env: { DATA_FILE: path.join(dataDir, "accounts.json") },
  },
  {
    name: "balancer",
    cwd: "services/balancer",
    port: ports.balancer,
    env: { ACCOUNTS_SERVICE_URL: url(ports.accounts) },
  },
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

const children = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(pathname, options = {}) {
  const response = await fetch(`${url(ports.gateway)}${pathname}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${pathname} failed: ${payload.message || response.status}`);
  }

  return payload;
}

async function waitForHealth(port, name) {
  const deadline = Date.now() + 15000;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url(port)}/health`);
      if (response.ok) return;
      lastError = `${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`${name} did not become healthy: ${lastError}`);
}

async function main() {
  for (const service of services) {
    const child = spawn(process.execPath, ["src/index.js"], {
      cwd: path.join(root, service.cwd),
      env: {
        ...process.env,
        ...common,
        ...service.env,
        PORT: String(service.port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => process.stdout.write(`[${service.name}] ${chunk}`));
    child.stderr.on("data", (chunk) => process.stderr.write(`[${service.name}] ${chunk}`));
    children.push(child);
  }

  for (const service of services) {
    await waitForHealth(service.port, service.name);
  }

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: "demo@liontech.finance", password: "Liontech@123" },
  });
  assert(login.token, "login token missing");
  const authHeaders = { authorization: `Bearer ${login.token}` };

  const accounts = await request("/api/accounts", { headers: authHeaders });
  assert(accounts.accounts.length >= 3, "seed accounts missing");

  const opened = await request("/api/accounts", {
    method: "POST",
    headers: authHeaders,
    body: { type: "saving", nickname: "Smoke Savings", initialDeposit: 25 },
  });
  assert(opened.account.id, "account creation failed");

  const deposit = await request("/api/deposits", {
    method: "POST",
    headers: authHeaders,
    body: { accountId: opened.account.id, amount: 30, method: "mobile-check" },
  });
  assert(deposit.account.balance >= 55, "deposit did not update balance");

  const transfer = await request("/api/transfers/etransfer", {
    method: "POST",
    headers: authHeaders,
    body: {
      fromAccountId: opened.account.id,
      recipientName: "Smoke Recipient",
      recipientEmail: "smoke@example.com",
      amount: 5,
      note: "Smoke test",
    },
  });
  assert(transfer.transfer.reference, "transfer reference missing");

  const analytics = await request("/api/analytics/overview", { headers: authHeaders });
  assert(analytics.totals.accounts >= 4, "analytics did not see created account");

  const ai = await request("/api/ai/assistant", {
    method: "POST",
    headers: authHeaders,
    body: { message: "How should I save and invest?" },
  });
  assert(ai.answer, "AI answer missing");

  const adminLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "admin@liontech.finance", password: "Admin@123" },
  });
  const admin = await request("/api/admin/dashboard", {
    headers: { authorization: `Bearer ${adminLogin.token}` },
  });
  assert(admin.analytics, "admin dashboard missing analytics");

  console.log("Smoke test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const child of children) {
      child.kill();
    }
  });
