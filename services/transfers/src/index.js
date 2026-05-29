const { getActor, requireUser, serviceHeaders } = require("../../../shared/src/auth");
const { money, publicBaseUrl, requestJson } = require("../../../shared/src/http");
const { createApp, sendJson } = require("../../../shared/src/server");
const { createId, createStore } = require("../../../shared/src/store");

const accountsUrl = () => publicBaseUrl("ACCOUNTS_SERVICE_URL", 3003);
const notificationsUrl = () => publicBaseUrl("NOTIFICATIONS_SERVICE_URL", 3005);

const store = createStore({
  transfers: [
    {
      id: "trn_demo_001",
      userId: "usr_demo_001",
      type: "e-transfer",
      fromAccountId: "acc_demo_current",
      recipientName: "LionTech Supplies",
      recipientEmail: "billing@liontech.example",
      amount: 275,
      fee: 0,
      currency: "USD",
      status: "completed",
      riskScore: 18,
      reference: "LTF-ETR-20260512",
      createdAt: "2026-05-12T15:10:00.000Z",
    },
  ],
});

const app = createApp({ serviceName: "transfers-service" });

function scoreRisk(payload) {
  let score = 12;

  if (payload.amount > 5000) {
    score += 35;
  } else if (payload.amount > 1000) {
    score += 15;
  }

  if (payload.type === "international") {
    score += 20;
  }

  if (["review", "high"].includes(payload.riskTier)) {
    score += 20;
  }

  return Math.min(score, 99);
}

async function verifyOwnedAccount(req, accountId) {
  return requestJson(`${accountsUrl()}/accounts/${encodeURIComponent(accountId)}`, {
    headers: {
      authorization: req.headers.authorization,
    },
  });
}

async function notify(userId, subject, message, metadata = {}) {
  return requestJson(`${notificationsUrl()}/notifications/send`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      userId,
      subject,
      message,
      metadata,
    }),
  }).catch(() => null);
}

app.get("/transfers", (req, res) => {
  const actor = getActor(req);
  const requestedUserId = req.query.userId;
  const transfers =
    actor.type === "service" || actor.role === "admin"
      ? store.state.transfers.filter((transfer) => !requestedUserId || transfer.userId === requestedUserId)
      : store.state.transfers.filter((transfer) => transfer.userId === actor.id);

  return sendJson(res, 200, {
    transfers,
  });
});

app.post("/transfers/etransfer", async (req, res) => {
  const user = requireUser(req);
  const amount = money(req.body.amount);
  const fromAccountId = String(req.body.fromAccountId || "").trim();
  const recipientName = String(req.body.recipientName || "").trim();
  const recipientEmail = String(req.body.recipientEmail || "").trim().toLowerCase();
  const recipientAccountNumber = String(req.body.recipientAccountNumber || "").trim();

  if (!fromAccountId || !recipientName || !recipientEmail || amount <= 0) {
    return sendJson(res, 400, {
      message: "Source account, recipient name, recipient email, and positive amount are required.",
    });
  }

  await verifyOwnedAccount(req, fromAccountId);

  const reference = `LTF-ETR-${Date.now().toString().slice(-8)}`;
  const riskScore = scoreRisk({ amount, type: "e-transfer" });
  const status = riskScore >= 70 ? "review" : "completed";

  const debit = await requestJson(`${accountsUrl()}/accounts/${encodeURIComponent(fromAccountId)}/debit`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      amount,
      reference,
      description: `E-transfer to ${recipientName}`,
      metadata: {
        recipientEmail,
      },
    }),
  });

  let recipientAccount = null;

  if (recipientAccountNumber) {
    recipientAccount = await requestJson(`${accountsUrl()}/accounts/${encodeURIComponent(recipientAccountNumber)}/credit`, {
      method: "POST",
      headers: serviceHeaders(),
      body: JSON.stringify({
        amount,
        reference,
        description: `E-transfer from ${user.name}`,
        metadata: {
          senderUserId: user.id,
        },
      }),
    }).catch(() => null);
  }

  const transfer = {
    id: createId("trn"),
    userId: user.id,
    type: "e-transfer",
    fromAccountId,
    recipientName,
    recipientEmail,
    recipientAccountNumber: recipientAccountNumber || null,
    amount,
    fee: 0,
    currency: debit.account.currency,
    status,
    riskScore,
    note: String(req.body.note || "").trim(),
    reference,
    createdAt: new Date().toISOString(),
  };

  store.state.transfers.unshift(transfer);
  store.save();

  await notify(user.id, "E-transfer sent", `Your $${amount.toFixed(2)} e-transfer to ${recipientName} is ${status}.`, {
    transferId: transfer.id,
  });

  return sendJson(res, 201, {
    transfer,
    account: debit.account,
    recipientAccount: recipientAccount?.account || null,
  });
});

app.post("/transfers/international", async (req, res) => {
  const user = requireUser(req);
  const amount = money(req.body.amount);
  const fromAccountId = String(req.body.fromAccountId || "").trim();
  const beneficiaryName = String(req.body.beneficiaryName || "").trim();
  const beneficiaryBank = String(req.body.beneficiaryBank || "").trim();
  const ibanSwift = String(req.body.ibanSwift || "").trim().toUpperCase();
  const country = String(req.body.country || "").trim();
  const targetCurrency = String(req.body.targetCurrency || "USD").trim().toUpperCase();
  const fee = money(Math.max(15, amount * 0.0125));
  const totalDebit = money(amount + fee);

  if (!fromAccountId || !beneficiaryName || !beneficiaryBank || !ibanSwift || !country || amount <= 0) {
    return sendJson(res, 400, {
      message: "International transfer details and a positive amount are required.",
    });
  }

  await verifyOwnedAccount(req, fromAccountId);

  const reference = `LTF-INT-${Date.now().toString().slice(-8)}`;
  const riskScore = scoreRisk({ amount, type: "international" });
  const status = riskScore >= 70 ? "review" : "processing";

  const debit = await requestJson(`${accountsUrl()}/accounts/${encodeURIComponent(fromAccountId)}/debit`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      amount: totalDebit,
      reference,
      description: `International transfer to ${beneficiaryName}`,
      metadata: {
        country,
        targetCurrency,
        fee,
      },
    }),
  });

  const transfer = {
    id: createId("trn"),
    userId: user.id,
    type: "international",
    fromAccountId,
    beneficiaryName,
    beneficiaryBank,
    ibanSwift,
    country,
    amount,
    fee,
    totalDebit,
    currency: debit.account.currency,
    targetCurrency,
    estimatedExchangeRate: targetCurrency === "USD" ? 1 : 0.92,
    status,
    riskScore,
    reason: String(req.body.reason || "family support").trim(),
    reference,
    createdAt: new Date().toISOString(),
  };

  store.state.transfers.unshift(transfer);
  store.save();

  await notify(
    user.id,
    "International transfer submitted",
    `Your international transfer to ${beneficiaryName} is ${status}. Fee: $${fee.toFixed(2)}.`,
    { transferId: transfer.id }
  );

  return sendJson(res, 201, {
    transfer,
    account: debit.account,
  });
});

app.patch("/transfers/:id/status", (req, res) => {
  const actor = getActor(req);

  if (actor.type !== "service" && actor.role !== "admin") {
    return sendJson(res, 403, { message: "Admin access is required." });
  }

  const transfer = store.state.transfers.find((candidate) => candidate.id === req.params.id);

  if (!transfer) {
    return sendJson(res, 404, { message: "Transfer not found." });
  }

  const status = String(req.body.status || "").toLowerCase();

  if (!["processing", "review", "completed", "declined", "cancelled"].includes(status)) {
    return sendJson(res, 400, { message: "Invalid transfer status." });
  }

  transfer.status = status;
  transfer.updatedAt = new Date().toISOString();
  store.save();

  notify(transfer.userId, "Transfer status updated", `Transfer ${transfer.reference} is now ${status}.`, {
    transferId: transfer.id,
  });

  return sendJson(res, 200, { transfer });
});

app.listen();
