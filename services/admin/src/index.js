const { requireAdmin, serviceHeaders } = require("../../../shared/src/auth");
const { publicBaseUrl, requestJson } = require("../../../shared/src/http");
const { createApp, sendJson } = require("../../../shared/src/server");

const analyticsUrl = () => publicBaseUrl("ANALYTICS_SERVICE_URL", 3008);
const authUrl = () => publicBaseUrl("AUTH_SERVICE_URL", 3001);
const profileUrl = () => publicBaseUrl("PROFILE_SERVICE_URL", 3002);
const transfersUrl = () => publicBaseUrl("TRANSFERS_SERVICE_URL", 3007);

const app = createApp({ serviceName: "admin-service" });

app.get("/admin/dashboard", async (req, res) => {
  requireAdmin(req);

  const [analytics, usersPayload, profilesPayload, transfersPayload] = await Promise.all([
    requestJson(`${analyticsUrl()}/analytics/admin`, {
      headers: serviceHeaders(),
    }),
    requestJson(`${authUrl()}/auth/users`, {
      headers: serviceHeaders(),
    }),
    requestJson(`${profileUrl()}/profiles`, {
      headers: serviceHeaders(),
    }),
    requestJson(`${transfersUrl()}/transfers`, {
      headers: serviceHeaders(),
    }),
  ]);

  const users = usersPayload.users || [];
  const profiles = profilesPayload.profiles || [];
  const transfers = transfersPayload.transfers || [];

  return sendJson(res, 200, {
    analytics,
    customers: users.filter((user) => user.role === "customer").map((user) => ({
      ...user,
      profile: profiles.find((profile) => profile.userId === user.id) || null,
    })),
    riskReviews: transfers.filter((transfer) => transfer.status === "review" || transfer.riskScore >= 70),
    operationalStatus: [
      { service: "auth", status: "healthy" },
      { service: "accounts", status: "healthy" },
      { service: "transfers", status: "healthy" },
      { service: "analytics", status: "healthy" },
      { service: "ai", status: "healthy" },
    ],
  });
});

app.get("/admin/customers", async (req, res) => {
  requireAdmin(req);

  const [usersPayload, profilesPayload] = await Promise.all([
    requestJson(`${authUrl()}/auth/users`, {
      headers: serviceHeaders(),
    }),
    requestJson(`${profileUrl()}/profiles`, {
      headers: serviceHeaders(),
    }),
  ]);

  const profiles = profilesPayload.profiles || [];

  return sendJson(res, 200, {
    customers: (usersPayload.users || [])
      .filter((user) => user.role === "customer")
      .map((user) => ({
        ...user,
        profile: profiles.find((profile) => profile.userId === user.id) || null,
      })),
  });
});

app.patch("/admin/transfers/:id/status", async (req, res) => {
  requireAdmin(req);

  const payload = await requestJson(`${transfersUrl()}/transfers/${encodeURIComponent(req.params.id)}/status`, {
    method: "PATCH",
    headers: serviceHeaders(),
    body: JSON.stringify({
      status: req.body.status,
    }),
  });

  return sendJson(res, 200, payload);
});

app.listen();
