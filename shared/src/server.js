const http = require("http");
const { URL } = require("url");

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json",
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (req.method === "GET" || req.method === "HEAD") {
    return {};
  }

  let body = "";

  for await (const chunk of req) {
    body += chunk;

    if (body.length > 1_000_000) {
      const error = new Error("Request body is too large.");
      error.status = 413;
      throw error;
    }
  }

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch (_error) {
    const error = new Error("Request body must be valid JSON.");
    error.status = 400;
    throw error;
  }
}

function matchRoute(pattern, pathname) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params = {};

  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];
    const pathPart = pathParts[index];

    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
      continue;
    }

    if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
}

function createApp({ serviceName }) {
  const routes = [];

  function add(method, path, handler) {
    routes.push({ method, path, handler });
  }

  const app = {
    get: (path, handler) => add("GET", path, handler),
    post: (path, handler) => add("POST", path, handler),
    patch: (path, handler) => add("PATCH", path, handler),
    delete: (path, handler) => add("DELETE", path, handler),
    listen: (port = Number(process.env.PORT || 3000)) => {
      const server = http.createServer(async (req, res) => {
        res.setHeader("access-control-allow-origin", "*");
        res.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
        res.setHeader("access-control-allow-headers", "content-type,authorization,x-service-token");

        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        try {
          const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
          const route = routes.find((candidate) => {
            if (candidate.method !== req.method) {
              return false;
            }

            return matchRoute(candidate.path, url.pathname);
          });

          if (!route) {
            sendJson(res, 404, {
              service: serviceName,
              message: `No route for ${req.method} ${url.pathname}`,
            });
            return;
          }

          req.params = matchRoute(route.path, url.pathname);
          req.query = Object.fromEntries(url.searchParams.entries());
          req.body = await readBody(req);

          await route.handler(req, res);
        } catch (error) {
          sendJson(res, error.status || 500, {
            service: serviceName,
            message: error.message || "Unexpected service error.",
            details: error.payload || null,
          });
        }
      });

      server.listen(port, () => {
        console.log(`${serviceName} listening on ${port}`);
      });

      return server;
    },
  };

  app.get("/", (_req, res) => {
    sendJson(res, 200, {
      service: serviceName,
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/health", (_req, res) => {
    sendJson(res, 200, {
      service: serviceName,
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

module.exports = {
  createApp,
  sendJson,
};
