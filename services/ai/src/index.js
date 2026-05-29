const { getActor, requireUser } = require("../../../shared/src/auth");
const { money, publicBaseUrl, requestJson } = require("../../../shared/src/http");
const { createApp, sendJson } = require("../../../shared/src/server");

const analyticsUrl = () => publicBaseUrl("ANALYTICS_SERVICE_URL", 3008);
const balancerUrl = () => publicBaseUrl("BALANCER_SERVICE_URL", 3004);

const app = createApp({ serviceName: "ai-service" });

function classifyMessage(message) {
  const normalized = message.toLowerCase();

  if (normalized.includes("transfer") || normalized.includes("send")) {
    return "transfer";
  }

  if (normalized.includes("save") || normalized.includes("saving")) {
    return "saving";
  }

  if (normalized.includes("invest")) {
    return "investment";
  }

  if (normalized.includes("fee") || normalized.includes("charge")) {
    return "fees";
  }

  return "general";
}

app.get("/ai/insights", async (req, res) => {
  requireUser(req);

  const [portfolio, analytics] = await Promise.all([
    requestJson(`${balancerUrl()}/balancer/portfolio`, {
      headers: { authorization: req.headers.authorization },
    }),
    requestJson(`${analyticsUrl()}/analytics/overview`, {
      headers: { authorization: req.headers.authorization },
    }),
  ]);

  const insights = [
    {
      title: "Portfolio health",
      detail: portfolio.recommendation,
      confidence: 0.91,
    },
    {
      title: "Liquidity signal",
      detail: `Your liquidity score is ${portfolio.liquidityScore}/100 with $${money(portfolio.totalBalance).toFixed(2)} across LionTech Finance.`,
      confidence: 0.88,
    },
    {
      title: "Activity pattern",
      detail: `${analytics.totals.transfers ? "Transfer activity is active" : "Transfer activity is light"} and deposits total $${money(
        analytics.totals.deposits
      ).toFixed(2)}.`,
      confidence: 0.84,
    },
  ];

  return sendJson(res, 200, {
    insights,
    generatedAt: new Date().toISOString(),
  });
});

app.post("/ai/assistant", async (req, res) => {
  requireUser(req);
  const message = String(req.body.message || "").trim();

  if (!message) {
    return sendJson(res, 400, { message: "Message is required." });
  }

  const intent = classifyMessage(message);
  const responses = {
    transfer:
      "For transfers, keep your recipient information exact and review the fee disclosure before submitting. International transfers above normal limits may enter review.",
    saving:
      "A healthy savings target is usually three to six months of expenses. Your LionTech saving account can act as the buffer before you increase investments.",
    investment:
      "Investment accounts can grow faster, but they should not hold money needed for immediate bills or emergency cash.",
    fees:
      "Domestic e-transfers have no platform fee in this demo. International transfers use a 1.25% fee with a $15 minimum.",
    general:
      "I can help review balances, transfer readiness, savings goals, and account mix across LionTech Finance.",
  };

  return sendJson(res, 200, {
    intent,
    answer: responses[intent],
    generatedAt: new Date().toISOString(),
  });
});

app.post("/ai/risk-score", (req, res) => {
  const actor = getActor(req);

  if (actor.type !== "service" && actor.role !== "admin") {
    return sendJson(res, 403, { message: "Service or admin access is required." });
  }

  const amount = Number(req.body.amount || 0);
  const country = String(req.body.country || "").toLowerCase();
  const international = Boolean(req.body.international);
  let score = 10;

  if (amount > 10000) score += 45;
  else if (amount > 5000) score += 30;
  else if (amount > 1000) score += 12;
  if (international) score += 18;
  if (["unknown", "restricted"].includes(country)) score += 25;

  score = Math.min(score, 99);

  return sendJson(res, 200, {
    score,
    band: score >= 70 ? "review" : score >= 40 ? "elevated" : "standard",
  });
});

app.listen();
