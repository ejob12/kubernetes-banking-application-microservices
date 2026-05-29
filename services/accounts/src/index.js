const { getActor, requireUser } = require("../../../shared/src/auth");
const { money } = require("../../../shared/src/http");
const { createApp, sendJson } = require("../../../shared/src/server");
const { createId, createStore } = require("../../../shared/src/store");

const ACCOUNT_TYPES = ["saving", "current", "investment"];

const store = createStore({
  accounts: [
    {
      id: "acc_demo_saving",
      userId: "usr_demo_001",
      accountNumber: "200100045001",
      type: "saving",
      nickname: "Everyday Savings",
      currency: "USD",
      balance: 12450.75,
      status: "active",
      interestRate: 3.25,
      openedAt: "2026-05-01T09:25:00.000Z",
      ledger: [],
    },
    {
      id: "acc_demo_current",
      userId: "usr_demo_001",
      accountNumber: "200100045002",
      type: "current",
      nickname: "Operating Current",
      currency: "USD",
      balance: 4860.2,
      status: "active",
      interestRate: 0,
      openedAt: "2026-05-01T09:28:00.000Z",
      ledger: [],
    },
    {
      id: "acc_demo_investment",
      userId: "usr_demo_001",
      accountNumber: "200100045003",
      type: "investment",
      nickname: "Growth Portfolio",
      currency: "USD",
      balance: 18340,
      status: "active",
      interestRate: 6.8,
      openedAt: "2026-05-01T09:32:00.000Z",
      ledger: [],
    },
  ],
});

const app = createApp({ serviceName: "accounts-service" });

function accountNumber() {
  return `2001${Math.floor(10000000 + Math.random() * 89999999)}`;
}

function accountForActor(account, actor) {
  if (actor.type === "service" || actor.role === "admin") {
    return true;
  }

  return account.userId === actor.id;
}

function findAccount(id) {
  return store.state.accounts.find((account) => account.id === id || account.accountNumber === id);
}

function applyLedgerEntry(account, entry) {
  account.balance = money(Number(account.balance) + Number(entry.amount));
  account.ledger.unshift({
    id: createId("led"),
    ...entry,
    amount: money(entry.amount),
    balanceAfter: account.balance,
    postedAt: new Date().toISOString(),
  });
  account.updatedAt = new Date().toISOString();
}

function summarize(accounts) {
  const totalBalance = money(accounts.reduce((sum, account) => sum + Number(account.balance), 0));
  const byType = ACCOUNT_TYPES.map((type) => {
    const balance = money(accounts.filter((account) => account.type === type).reduce((sum, account) => sum + account.balance, 0));
    return {
      type,
      balance,
      share: totalBalance ? money((balance / totalBalance) * 100) : 0,
    };
  });

  return {
    totalBalance,
    accounts: accounts.length,
    byType,
  };
}

app.get("/accounts", (req, res) => {
  const actor = getActor(req);
  const requestedUserId = req.query.userId;
  const accounts =
    actor.type === "service" || actor.role === "admin"
      ? store.state.accounts.filter((account) => !requestedUserId || account.userId === requestedUserId)
      : store.state.accounts.filter((account) => account.userId === actor.id);

  return sendJson(res, 200, {
    accounts,
    summary: summarize(accounts),
  });
});

app.post("/accounts", (req, res) => {
  const user = requireUser(req);
  const type = String(req.body.type || "").toLowerCase();
  const initialDeposit = money(req.body.initialDeposit || 0);

  if (!ACCOUNT_TYPES.includes(type)) {
    return sendJson(res, 400, {
      message: "Account type must be saving, current, or investment.",
    });
  }

  if (initialDeposit < 0) {
    return sendJson(res, 400, { message: "Initial deposit cannot be negative." });
  }

  const account = {
    id: createId("acc"),
    userId: user.id,
    accountNumber: accountNumber(),
    type,
    nickname: String(req.body.nickname || `${type} account`).trim(),
    currency: String(req.body.currency || "USD").trim().toUpperCase(),
    balance: initialDeposit,
    status: "active",
    interestRate: type === "investment" ? 6.4 : type === "saving" ? 3.1 : 0,
    openedAt: new Date().toISOString(),
    ledger: [],
  };

  if (initialDeposit > 0) {
    applyLedgerEntry(account, {
      type: "credit",
      amount: initialDeposit,
      description: "Opening deposit",
      reference: createId("dep"),
    });
  }

  store.state.accounts.push(account);
  store.save();

  return sendJson(res, 201, { account });
});

app.get("/accounts/summary", (req, res) => {
  const actor = getActor(req);
  const requestedUserId = req.query.userId;
  const accounts =
    actor.type === "service" || actor.role === "admin"
      ? store.state.accounts.filter((account) => !requestedUserId || account.userId === requestedUserId)
      : store.state.accounts.filter((account) => account.userId === actor.id);

  return sendJson(res, 200, summarize(accounts));
});

app.get("/accounts/by-number/:accountNumber", (req, res) => {
  const actor = getActor(req);
  const account = store.state.accounts.find((candidate) => candidate.accountNumber === req.params.accountNumber);

  if (!account || !accountForActor(account, actor)) {
    return sendJson(res, 404, { message: "Account not found." });
  }

  return sendJson(res, 200, { account });
});

app.get("/accounts/:id", (req, res) => {
  const actor = getActor(req);
  const account = findAccount(req.params.id);

  if (!account || !accountForActor(account, actor)) {
    return sendJson(res, 404, { message: "Account not found." });
  }

  return sendJson(res, 200, { account });
});

app.patch("/accounts/:id", (req, res) => {
  const actor = getActor(req);
  const account = findAccount(req.params.id);

  if (!account || !accountForActor(account, actor)) {
    return sendJson(res, 404, { message: "Account not found." });
  }

  if (req.body.nickname !== undefined) {
    account.nickname = String(req.body.nickname).trim();
  }

  if ((actor.type === "service" || actor.role === "admin") && req.body.status) {
    const status = String(req.body.status).toLowerCase();

    if (!["active", "frozen", "closed"].includes(status)) {
      return sendJson(res, 400, { message: "Status must be active, frozen, or closed." });
    }

    account.status = status;
  }

  account.updatedAt = new Date().toISOString();
  store.save();

  return sendJson(res, 200, { account });
});

app.post("/accounts/:id/credit", (req, res) => {
  const actor = getActor(req);

  if (actor.type !== "service" && actor.role !== "admin") {
    return sendJson(res, 403, { message: "Service or admin access is required." });
  }

  const account = findAccount(req.params.id);
  const amount = money(req.body.amount);

  if (!account) {
    return sendJson(res, 404, { message: "Account not found." });
  }

  if (account.status !== "active") {
    return sendJson(res, 409, { message: "This account is not active." });
  }

  if (amount <= 0) {
    return sendJson(res, 400, { message: "Amount must be greater than zero." });
  }

  applyLedgerEntry(account, {
    type: "credit",
    amount,
    description: req.body.description || "Credit",
    reference: req.body.reference || createId("crd"),
    metadata: req.body.metadata || {},
  });
  store.save();

  return sendJson(res, 200, { account });
});

app.post("/accounts/:id/debit", (req, res) => {
  const actor = getActor(req);

  if (actor.type !== "service" && actor.role !== "admin") {
    return sendJson(res, 403, { message: "Service or admin access is required." });
  }

  const account = findAccount(req.params.id);
  const amount = money(req.body.amount);

  if (!account) {
    return sendJson(res, 404, { message: "Account not found." });
  }

  if (account.status !== "active") {
    return sendJson(res, 409, { message: "This account is not active." });
  }

  if (amount <= 0) {
    return sendJson(res, 400, { message: "Amount must be greater than zero." });
  }

  if (account.balance < amount) {
    return sendJson(res, 409, { message: "Insufficient funds." });
  }

  applyLedgerEntry(account, {
    type: "debit",
    amount: -amount,
    description: req.body.description || "Debit",
    reference: req.body.reference || createId("dbt"),
    metadata: req.body.metadata || {},
  });
  store.save();

  return sendJson(res, 200, { account });
});

app.listen();
