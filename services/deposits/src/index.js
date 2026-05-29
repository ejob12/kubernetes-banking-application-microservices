const { getActor, requireUser, serviceHeaders } = require("../../../shared/src/auth");
const { money, publicBaseUrl, requestJson } = require("../../../shared/src/http");
const { createApp, sendJson } = require("../../../shared/src/server");
const { createId, createStore } = require("../../../shared/src/store");

const accountsUrl = () => publicBaseUrl("ACCOUNTS_SERVICE_URL", 3003);
const notificationsUrl = () => publicBaseUrl("NOTIFICATIONS_SERVICE_URL", 3005);

const store = createStore({
  deposits: [
    {
      id: "dep_demo_001",
      userId: "usr_demo_001",
      accountId: "acc_demo_saving",
      amount: 850,
      method: "mobile-check",
      status: "posted",
      reference: "LTF-DEP-1001",
      createdAt: "2026-05-10T13:25:00.000Z",
    },
  ],
});

const app = createApp({ serviceName: "deposits-service" });

app.get("/deposits", (req, res) => {
  const actor = getActor(req);
  const requestedUserId = req.query.userId;
  const deposits =
    actor.type === "service" || actor.role === "admin"
      ? store.state.deposits.filter((deposit) => !requestedUserId || deposit.userId === requestedUserId)
      : store.state.deposits.filter((deposit) => deposit.userId === actor.id);

  return sendJson(res, 200, {
    deposits,
    totalPosted: money(deposits.filter((deposit) => deposit.status === "posted").reduce((sum, deposit) => sum + deposit.amount, 0)),
  });
});

app.post("/deposits", async (req, res) => {
  const user = requireUser(req);
  const amount = money(req.body.amount);
  const accountId = String(req.body.accountId || "").trim();
  const method = String(req.body.method || "bank-counter").trim();

  if (!accountId || amount <= 0) {
    return sendJson(res, 400, {
      message: "Account and positive amount are required.",
    });
  }

  await requestJson(`${accountsUrl()}/accounts/${encodeURIComponent(accountId)}`, {
    headers: {
      authorization: req.headers.authorization,
    },
  });

  const reference = `LTF-DEP-${Date.now().toString().slice(-8)}`;
  const deposit = {
    id: createId("dep"),
    userId: user.id,
    accountId,
    amount,
    method,
    status: "posted",
    reference,
    note: String(req.body.note || "").trim(),
    createdAt: new Date().toISOString(),
  };

  const credit = await requestJson(`${accountsUrl()}/accounts/${encodeURIComponent(accountId)}/credit`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      amount,
      reference,
      description: `Deposit via ${method}`,
      metadata: {
        depositId: deposit.id,
      },
    }),
  });

  store.state.deposits.unshift(deposit);
  store.save();

  await requestJson(`${notificationsUrl()}/notifications/send`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      userId: user.id,
      subject: "Deposit posted",
      message: `Your ${method} deposit of $${amount.toFixed(2)} was posted to ${credit.account.nickname}.`,
      metadata: {
        depositId: deposit.id,
        accountId,
      },
    }),
  }).catch(() => null);

  return sendJson(res, 201, {
    deposit,
    account: credit.account,
  });
});

app.listen();
