const http = require("http");
const { URL } = require("url");

const port = Number(process.env.PORT || 8080);

const registry = [
  { name: "auth", prefix: "/api/auth", upstreamPath: "/auth", target: process.env.AUTH_SERVICE_URL || "http://localhost:3001" },
  { name: "profiles", prefix: "/api/profiles", upstreamPath: "/profiles", target: process.env.PROFILE_SERVICE_URL || "http://localhost:3002" },
  { name: "accounts", prefix: "/api/accounts", upstreamPath: "/accounts", target: process.env.ACCOUNTS_SERVICE_URL || "http://localhost:3003" },
  { name: "balancer", prefix: "/api/balancer", upstreamPath: "/balancer", target: process.env.BALANCER_SERVICE_URL || "http://localhost:3004" },
  { name: "notifications", prefix: "/api/notifications", upstreamPath: "/notifications", target: process.env.NOTIFICATIONS_SERVICE_URL || "http://localhost:3005" },
  { name: "deposits", prefix: "/api/deposits", upstreamPath: "/deposits", target: process.env.DEPOSITS_SERVICE_URL || "http://localhost:3006" },
  { name: "transfers", prefix: "/api/transfers", upstreamPath: "/transfers", target: process.env.TRANSFERS_SERVICE_URL || "http://localhost:3007" },
  { name: "analytics", prefix: "/api/analytics", upstreamPath: "/analytics", target: process.env.ANALYTICS_SERVICE_URL || "http://localhost:3008" },
  { name: "ai", prefix: "/api/ai", upstreamPath: "/ai", target: process.env.AI_SERVICE_URL || "http://localhost:3009" },
  { name: "admin", prefix: "/api/admin", upstreamPath: "/admin", target: process.env.ADMIN_SERVICE_URL || "http://localhost:3010" },
].sort((a, b) => b.prefix.length - a.prefix.length);

function writeJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-service-token",
  });
  res.end(JSON.stringify(payload));
}

function proxy(req, res, route, url) {
  const target = new URL(route.target);
  const suffix = url.pathname.slice(route.prefix.length);
  const upstreamPath = `${route.upstreamPath}${suffix}${url.search}`;
  const options = {
    hostname: target.hostname,
    port: target.port || (target.protocol === "https:" ? 443 : 80),
    protocol: target.protocol,
    method: req.method,
    path: upstreamPath,
    headers: {
      ...req.headers,
      host: target.host,
    },
  };

  const upstream = http.request(options, (upstreamResponse) => {
    res.writeHead(upstreamResponse.statusCode || 502, {
      ...upstreamResponse.headers,
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type,authorization,x-service-token",
    });
    upstreamResponse.pipe(res);
  });

  upstream.on("error", (error) => {
    writeJson(res, 502, {
      gateway: "liontech-finance-gateway",
      service: route.name,
      message: error.message,
    });
  });

  req.pipe(upstream);
}

async function health() {
  const statuses = await Promise.all(
    registry.map(async (route) => {
      try {
        const response = await fetch(`${route.target}/health`);
        const payload = await response.json();
        return {
          name: route.name,
          status: response.ok ? "ok" : "degraded",
          target: route.target,
          details: payload,
        };
      } catch (error) {
        return {
          name: route.name,
          status: "down",
          target: route.target,
          details: error.message,
        };
      }
    })
  );

  return {
    gateway: "ok",
    services: statuses,
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization,x-service-token");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/" || url.pathname === "/api") {
    writeJson(res, 200, {
      name: "liontech-finance-api-gateway",
      status: "ok",
      routes: registry.map(({ name, prefix, target }) => ({ name, prefix, target })),
    });
    return;
  }

  if (url.pathname === "/health") {
    writeJson(res, 200, await health());
    return;
  }

  const route = registry.find((candidate) => url.pathname === candidate.prefix || url.pathname.startsWith(`${candidate.prefix}/`));

  if (!route) {
    writeJson(res, 404, {
      message: `No gateway route for ${url.pathname}`,
    });
    return;
  }

  proxy(req, res, route, url);
});

server.listen(port, () => {
  console.log(`liontech-finance-api-gateway listening on ${port}`);
});
