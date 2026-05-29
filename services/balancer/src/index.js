const { requireUser } = require("../../../shared/src/auth");
const { money, publicBaseUrl, requestJson } = require("../../../shared/src/http");
const { createApp, sendJson } = require("../../../shared/src/server");

const accountsUrl = () => publicBaseUrl("ACCOUNTS_SERVICE_URL", 3003);

const app = createApp({ serviceName: "balancer-service" });

const fxRates = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
  CAD: 1.37,
  HTG: 132.5,
  DOP: 58.7,
  JPY: 157.9,
};

function recommendation(summary) {
  const investment = summary.byType.find((item) => item.type === "investment")?.share || 0;
  const saving = summary.byType.find((item) => item.type === "saving")?.share || 0;
  const current = summary.byType.find((item) => item.type === "current")?.share || 0;

  if (summary.totalBalance < 1000) {
    return "Build a stronger emergency reserve before moving funds into investment products.";
  }

  if (current > 45) {
    return "Your current account is carrying idle cash. Consider moving part of it into savings or investment.";
  }

  if (investment < 25 && saving > 35) {
    return "You may have room to increase investment exposure while keeping your savings buffer intact.";
  }

  return "Your account mix is balanced for everyday liquidity and long-term growth.";
}

app.get("/balancer/rates", (_req, res) => {
  return sendJson(res, 200, {
    base: "USD",
    rates: fxRates,
    refreshedAt: new Date().toISOString(),
  });
});

app.get("/balancer/portfolio", async (req, res) => {
  requireUser(req);

  const accountsPayload = await requestJson(`${accountsUrl()}/accounts`, {
    headers: {
      authorization: req.headers.authorization,
    },
  });
  const accounts = accountsPayload.accounts;
  const summary = accountsPayload.summary;
  const monthlyCashflow = money(accounts.reduce((sum, account) => sum + account.balance * (account.type === "investment" ? 0.012 : 0.004), 0));

  return sendJson(res, 200, {
    ...summary,
    liquidityScore: Math.min(100, Math.round((summary.byType.find((item) => item.type === "saving")?.share || 0) * 2.2)),
    projectedMonthlyYield: monthlyCashflow,
    recommendation: recommendation(summary),
  });
});

app.post("/balancer/rebalance", async (req, res) => {
  requireUser(req);

  const targetInvestmentShare = Math.min(Math.max(Number(req.body.targetInvestmentShare || 35), 0), 80);
  const accountsPayload = await requestJson(`${accountsUrl()}/accounts`, {
    headers: {
      authorization: req.headers.authorization,
    },
  });
  const summary = accountsPayload.summary;
  const currentInvestmentShare = summary.byType.find((item) => item.type === "investment")?.share || 0;
  const gap = money(summary.totalBalance * ((targetInvestmentShare - currentInvestmentShare) / 100));

  return sendJson(res, 200, {
    targetInvestmentShare,
    currentInvestmentShare,
    suggestedMove: gap > 0 ? money(gap) : 0,
    message:
      gap > 0
        ? `Move about $${money(gap).toFixed(2)} from savings or current into investment to reach your target.`
        : "Your investment allocation is already at or above the selected target.",
  });
});

app.listen();
