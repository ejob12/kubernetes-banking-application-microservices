const { getActor, serviceHeaders } = require("../../../shared/src/auth");
const { money, publicBaseUrl, requestJson } = require("../../../shared/src/http");
const { createApp, sendJson } = require("../../../shared/src/server");

const accountsUrl = () => publicBaseUrl("ACCOUNTS_SERVICE_URL", 3003);
const depositsUrl = () => publicBaseUrl("DEPOSITS_SERVICE_URL", 3006);
const transfersUrl = () => publicBaseUrl("TRANSFERS_SERVICE_URL", 3007);
const authUrl = () => publicBaseUrl("AUTH_SERVICE_URL", 3001);

const app = createApp({ serviceName: "analytics-service" });

function headersForActor(req, actor) {
  if (actor.type === "service" || actor.role === "admin") {
    return serviceHeaders();
  }

  return {
    authorization: req.headers.authorization,
  };
}

async function loadData(req, actor) {
  const headers = headersForActor(req, actor);
  const [accountsPayload, depositsPayload, transfersPayload] = await Promise.all([
    requestJson(`${accountsUrl()}/accounts`, { headers }),
    requestJson(`${depositsUrl()}/deposits`, { headers }),
    requestJson(`${transfersUrl()}/transfers`, { headers }),
  ]);

  return {
    accounts: accountsPayload.accounts || [],
    accountSummary: accountsPayload.summary || { totalBalance: 0, byType: [] },
    deposits: depositsPayload.deposits || [],
    transfers: transfersPayload.transfers || [],
  };
}

function buildOverview(data) {
  const completedTransfers = data.transfers.filter((transfer) => ["completed", "processing"].includes(transfer.status));
  const transferVolume = money(completedTransfers.reduce((sum, transfer) => sum + transfer.amount, 0));
  const feeRevenue = money(data.transfers.reduce((sum, transfer) => sum + (transfer.fee || 0), 0));
  const depositsVolume = money(data.deposits.reduce((sum, deposit) => sum + deposit.amount, 0));
  const riskQueue = data.transfers.filter((transfer) => transfer.status === "review" || transfer.riskScore >= 70);

  return {
    totals: {
      assets: data.accountSummary.totalBalance,
      accounts: data.accounts.length,
      deposits: depositsVolume,
      transfers: transferVolume,
      feeRevenue,
      riskQueue: riskQueue.length,
    },
    accountMix: data.accountSummary.byType,
    transferStatus: ["completed", "processing", "review", "declined", "cancelled"].map((status) => ({
      status,
      count: data.transfers.filter((transfer) => transfer.status === status).length,
    })),
    recentActivity: [...data.deposits, ...data.transfers]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 8),
  };
}

app.get("/analytics/overview", async (req, res) => {
  const actor = getActor(req);
  const data = await loadData(req, actor);

  return sendJson(res, 200, buildOverview(data));
});

app.get("/analytics/admin", async (req, res) => {
  const actor = getActor(req);

  if (actor.type !== "service" && actor.role !== "admin") {
    return sendJson(res, 403, { message: "Admin access is required." });
  }

  const [data, usersPayload] = await Promise.all([
    loadData({ headers: {} }, { type: "service", role: "service" }),
    requestJson(`${authUrl()}/auth/users`, {
      headers: serviceHeaders(),
    }),
  ]);

  const overview = buildOverview(data);
  const customers = (usersPayload.users || []).filter((user) => user.role === "customer");

  return sendJson(res, 200, {
    ...overview,
    customers: customers.length,
    activeCustomers: customers.filter((user) => user.status === "active").length,
  });
});

app.listen();
