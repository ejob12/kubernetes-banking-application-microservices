const API_BASE =
  window.LIONTECH_API_BASE || (window.location.protocol === "file:" ? "http://localhost:8080/api" : `${window.location.origin}/api`);

const state = {
  token: localStorage.getItem("liontechFinanceToken") || "",
  user: null,
  profile: null,
  accounts: [],
  summary: { totalBalance: 0, byType: [] },
  deposits: [],
  transfers: [],
  notifications: [],
  portfolio: null,
  analytics: null,
  insights: [],
  admin: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(window.__liontechToastTimer);
  window.__liontechToastTimer = setTimeout(() => node.classList.remove("show"), 3200);
}

async function api(path, options = {}) {
  const headers = {
    "content-type": "application/json",
    ...(options.headers || {}),
  };

  if (state.token && options.auth !== false) {
    headers.authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.message || `Request failed with ${response.status}`);
  }

  return payload;
}

async function safeApi(path, fallback) {
  try {
    return await api(path);
  } catch (error) {
    console.warn(path, error.message);
    return fallback;
  }
}

function saveSession(payload) {
  state.token = payload.token;
  state.user = payload.user;
  localStorage.setItem("liontechFinanceToken", payload.token);
}

function logout() {
  localStorage.removeItem("liontechFinanceToken");
  state.token = "";
  state.user = null;
  $("#app-shell").classList.add("hidden");
  $("#auth-screen").classList.remove("hidden");
}

function showApp() {
  $("#auth-screen").classList.add("hidden");
  $("#app-shell").classList.remove("hidden");
}

function showView(viewName) {
  $$(".view").forEach((view) => view.classList.remove("active"));
  $(`#view-${viewName}`)?.classList.add("active");
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.viewLink === viewName));
}

function accountOption(account) {
  return `${account.nickname} • ${account.type} • ${account.accountNumber.slice(-4)} • ${money(account.balance)}`;
}

function fillAccountSelects() {
  $$("[data-account-select]").forEach((select) => {
    select.innerHTML = state.accounts
      .map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(accountOption(account))}</option>`)
      .join("");
  });
}

function renderProfile() {
  const profile = state.profile || {};
  const form = $("#profile-form");
  const values = {
    legalName: profile.legalName || state.user?.name || "",
    preferredName: profile.preferredName || "",
    dateOfBirth: profile.dateOfBirth || "",
    phone: profile.phone || state.user?.phone || "",
    address: profile.address || "",
    country: profile.country || "",
    occupation: profile.occupation || "",
    employer: profile.employer || "",
  };

  Object.entries(values).forEach(([name, value]) => {
    if (form.elements[name]) {
      form.elements[name].value = value;
    }
  });

  const status = profile.kycStatus || "pending";
  $("#profile-status").textContent = status;
  $("#kyc-pill").textContent = `KYC ${status}`;
}

function renderAccounts() {
  const list = state.accounts
    .map(
      (account) => `
        <article class="account-card">
          <header>
            <div>
              <strong>${money(account.balance)}</strong>
              <div class="muted">${escapeHtml(account.nickname)}</div>
            </div>
            <span class="tag">${escapeHtml(account.type)}</span>
          </header>
          <div class="tag-row">
            <span class="tag">${escapeHtml(account.currency)}</span>
            <span class="tag">••${escapeHtml(account.accountNumber.slice(-4))}</span>
            <span class="tag">${escapeHtml(account.status)}</span>
          </div>
        </article>`
    )
    .join("");

  const empty = '<p class="muted">No accounts yet.</p>';
  $("#account-list").innerHTML = list || empty;
  $("#account-book").innerHTML = list || empty;
  fillAccountSelects();
}

function renderActivity() {
  $("#deposit-list").innerHTML =
    state.deposits
      .map(
        (deposit) => `
          <article class="activity-card">
            <header>
              <strong>${money(deposit.amount)}</strong>
              <span class="tag">${escapeHtml(deposit.status)}</span>
            </header>
            <div class="muted">${escapeHtml(deposit.method)} · ${escapeHtml(deposit.reference)}</div>
          </article>`
      )
      .join("") || '<p class="muted">No deposits posted.</p>';

  $("#transfer-list").innerHTML =
    state.transfers
      .map((transfer) => {
        const target = transfer.type === "international" ? transfer.beneficiaryName : transfer.recipientName;
        return `
          <article class="activity-card">
            <header>
              <strong>${money(transfer.amount)}</strong>
              <span class="tag">${escapeHtml(transfer.status)}</span>
            </header>
            <div>${escapeHtml(transfer.type)} to ${escapeHtml(target)}</div>
            <div class="muted">${escapeHtml(transfer.reference)} · Risk ${escapeHtml(transfer.riskScore)}</div>
          </article>`;
      })
      .join("") || '<p class="muted">No transfers sent.</p>';

  $("#notification-list").innerHTML =
    state.notifications
      .map(
        (notification) => `
          <article class="activity-card">
            <header>
              <strong>${escapeHtml(notification.subject)}</strong>
              <span class="tag">${notification.read ? "read" : "new"}</span>
            </header>
            <div class="muted">${escapeHtml(notification.message)}</div>
          </article>`
      )
      .join("") || '<p class="muted">No notifications.</p>';
}

function renderInsights() {
  $("#insight-list").innerHTML =
    state.insights
      .map(
        (insight) => `
          <article class="insight-card">
            <strong>${escapeHtml(insight.title)}</strong>
            <div class="muted">${escapeHtml(insight.detail)}</div>
          </article>`
      )
      .join("") || '<p class="muted">AI insights are warming up.</p>';
}

function renderAdmin() {
  const isAdmin = state.user?.role === "admin";
  $$(".admin-only").forEach((node) => node.classList.toggle("hidden", !isAdmin));

  if (!isAdmin || !state.admin) {
    return;
  }

  const totals = state.admin.analytics?.totals || {};
  $("#admin-metrics").innerHTML = [
    ["Assets", money(totals.assets)],
    ["Customers", state.admin.customers?.length || 0],
    ["Risk queue", state.admin.riskReviews?.length || 0],
    ["Fee revenue", money(totals.feeRevenue)],
  ]
    .map(
      ([label, value]) => `
        <article class="metric-card">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>`
    )
    .join("");

  $("#admin-customers").innerHTML =
    (state.admin.customers || [])
      .map(
        (customer) => `
          <article class="customer-card">
            <header>
              <strong>${escapeHtml(customer.name)}</strong>
              <span class="tag">${escapeHtml(customer.status)}</span>
            </header>
            <div class="muted">${escapeHtml(customer.email)}</div>
            <div class="muted">${escapeHtml(customer.profile?.kycStatus || "profile pending")}</div>
          </article>`
      )
      .join("") || '<p class="muted">No customers.</p>';

  $("#admin-risk").innerHTML =
    (state.admin.riskReviews || [])
      .map(
        (transfer) => `
          <article class="activity-card">
            <header>
              <strong>${money(transfer.amount)}</strong>
              <span class="tag">${escapeHtml(transfer.status)}</span>
            </header>
            <div>${escapeHtml(transfer.reference)}</div>
            <div class="muted">Risk score ${escapeHtml(transfer.riskScore)}</div>
          </article>`
      )
      .join("") || '<p class="muted">No transfers in review.</p>';
}

function renderDashboard() {
  $("#welcome-title").textContent = `Welcome, ${state.profile?.preferredName || state.user?.name || "Client"}`;
  $("#total-balance").textContent = money(state.summary.totalBalance);
  $("#portfolio-message").textContent = state.portfolio?.recommendation || "Your LionTech Finance portfolio is ready.";
  $("#metric-accounts").textContent = state.accounts.length;
  $("#metric-deposits").textContent = money(state.analytics?.totals?.deposits || 0);
  $("#metric-transfers").textContent = money(state.analytics?.totals?.transfers || 0);
  $("#metric-liquidity").textContent = `${state.portfolio?.liquidityScore || 0}/100`;

  renderProfile();
  renderAccounts();
  renderActivity();
  renderInsights();
  renderAdmin();
}

async function loadData() {
  const me = await api("/auth/me");
  state.user = me.user;

  const [profile, accounts, deposits, transfers, notifications, portfolio, analytics, ai] = await Promise.all([
    safeApi("/profiles/me", { profile: null }),
    safeApi("/accounts", { accounts: [], summary: { totalBalance: 0, byType: [] } }),
    safeApi("/deposits", { deposits: [] }),
    safeApi("/transfers", { transfers: [] }),
    safeApi("/notifications", { notifications: [] }),
    safeApi("/balancer/portfolio", null),
    safeApi("/analytics/overview", null),
    safeApi("/ai/insights", { insights: [] }),
  ]);

  state.profile = profile.profile;
  state.accounts = accounts.accounts || [];
  state.summary = accounts.summary || { totalBalance: 0, byType: [] };
  state.deposits = deposits.deposits || [];
  state.transfers = transfers.transfers || [];
  state.notifications = notifications.notifications || [];
  state.portfolio = portfolio;
  state.analytics = analytics;
  state.insights = ai.insights || [];
  state.admin = state.user.role === "admin" ? await safeApi("/admin/dashboard", null) : null;

  renderDashboard();
  showApp();
}

async function login(email, password) {
  const payload = await api("/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
  saveSession(payload);
  await loadData();
  toast("Signed in to LionTech Finance.");
}

function formPayload(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function bindAuth() {
  $$(".auth-tab").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".auth-tab").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      $("#login-form").classList.toggle("hidden", button.dataset.authTab !== "login");
      $("#register-form").classList.toggle("hidden", button.dataset.authTab !== "register");
    });
  });

  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = formPayload(event.currentTarget);

    try {
      await login(payload.email, payload.password);
    } catch (error) {
      toast(error.message);
    }
  });

  $("#admin-login").addEventListener("click", async () => {
    try {
      await login("admin@liontech.finance", "Admin@123");
      showView("admin");
    } catch (error) {
      toast(error.message);
    }
  });

  $("#register-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = formPayload(event.currentTarget);

    try {
      const session = await api("/auth/register", {
        method: "POST",
        auth: false,
        body: {
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          password: payload.password,
        },
      });
      saveSession(session);
      await api("/profiles/me", {
        method: "POST",
        body: {
          legalName: payload.name,
          phone: payload.phone,
          address: payload.address,
          country: payload.country,
        },
      });
      await loadData();
      showView("profile");
      toast("LionTech Finance profile created.");
    } catch (error) {
      toast(error.message);
    }
  });
}

function bindApp() {
  document.body.addEventListener("click", (event) => {
    const link = event.target.closest("[data-view-link]");

    if (link) {
      event.preventDefault();
      showView(link.dataset.viewLink);
    }
  });

  $("#logout").addEventListener("click", logout);
  $("#refresh-data").addEventListener("click", async () => {
    try {
      await loadData();
      toast("Banking data refreshed.");
    } catch (error) {
      toast(error.message);
    }
  });

  $("#profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await api("/profiles/me", {
        method: "POST",
        body: formPayload(event.currentTarget),
      });
      await loadData();
      toast("Profile saved.");
    } catch (error) {
      toast(error.message);
    }
  });

  $("#account-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = formPayload(event.currentTarget);

    try {
      await api("/accounts", {
        method: "POST",
        body: {
          ...payload,
          initialDeposit: Number(payload.initialDeposit || 0),
        },
      });
      event.currentTarget.reset();
      event.currentTarget.elements.initialDeposit.value = "100";
      await loadData();
      toast("Account opened.");
    } catch (error) {
      toast(error.message);
    }
  });

  $("#deposit-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = formPayload(event.currentTarget);

    try {
      await api("/deposits", {
        method: "POST",
        body: {
          ...payload,
          amount: Number(payload.amount),
        },
      });
      await loadData();
      toast("Deposit posted.");
    } catch (error) {
      toast(error.message);
    }
  });

  $("#etransfer-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = formPayload(event.currentTarget);

    try {
      await api("/transfers/etransfer", {
        method: "POST",
        body: {
          ...payload,
          amount: Number(payload.amount),
        },
      });
      await loadData();
      toast("E-transfer submitted.");
    } catch (error) {
      toast(error.message);
    }
  });

  $("#international-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = formPayload(event.currentTarget);

    try {
      await api("/transfers/international", {
        method: "POST",
        body: {
          ...payload,
          amount: Number(payload.amount),
        },
      });
      await loadData();
      toast("International transfer submitted.");
    } catch (error) {
      toast(error.message);
    }
  });

  $("#ai-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = formPayload(event.currentTarget);

    try {
      const result = await api("/ai/assistant", {
        method: "POST",
        body: payload,
      });
      $("#ai-answer").textContent = result.answer;
    } catch (error) {
      toast(error.message);
    }
  });
}

async function boot() {
  bindAuth();
  bindApp();

  if (!state.token) {
    return;
  }

  try {
    await loadData();
  } catch (error) {
    logout();
    toast(error.message);
  }
}

boot();
