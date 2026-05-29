const { createPasswordHash, createToken, getActor, requireUser, verifyPassword } = require("../../../shared/src/auth");
const { createApp, sendJson } = require("../../../shared/src/server");
const { createId, createStore } = require("../../../shared/src/store");

function makeSeedState() {
  return {
    users: [
      {
        id: "usr_demo_001",
        name: "LionTech Demo Client",
        email: "demo@liontech.finance",
        phone: "+1 305 555 0188",
        role: "customer",
        status: "active",
        passwordHash: createPasswordHash("Liontech@123", "demo-customer-salt"),
        createdAt: "2026-05-01T09:00:00.000Z",
      },
      {
        id: "usr_admin_001",
        name: "LionTech Finance Admin",
        email: "admin@liontech.finance",
        phone: "+1 305 555 0100",
        role: "admin",
        status: "active",
        passwordHash: createPasswordHash("Admin@123", "demo-admin-salt"),
        createdAt: "2026-05-01T09:05:00.000Z",
      },
    ],
  };
}

const store = createStore(makeSeedState());
const app = createApp({ serviceName: "auth-service" });

function sanitize(user) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

app.post("/auth/register", (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const phone = String(req.body.phone || "").trim();

  if (!name || !email || password.length < 8) {
    return sendJson(res, 400, {
      message: "Name, email, and an 8 character password are required.",
    });
  }

  if (store.state.users.some((user) => user.email === email)) {
    return sendJson(res, 409, {
      message: "An account already exists for this email.",
    });
  }

  const user = {
    id: createId("usr"),
    name,
    email,
    phone,
    role: "customer",
    status: "active",
    passwordHash: createPasswordHash(password),
    createdAt: new Date().toISOString(),
  };

  store.state.users.push(user);
  store.save();

  return sendJson(res, 201, {
    user: sanitize(user),
    token: createToken(user),
  });
});

app.post("/auth/login", (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const user = store.state.users.find((candidate) => candidate.email === email);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return sendJson(res, 401, {
      message: "Invalid email or password.",
    });
  }

  if (user.status !== "active") {
    return sendJson(res, 403, {
      message: "This user is not active.",
    });
  }

  return sendJson(res, 200, {
    user: sanitize(user),
    token: createToken(user),
  });
});

app.get("/auth/me", (req, res) => {
  const user = requireUser(req);
  const fullUser = store.state.users.find((candidate) => candidate.id === user.id);

  if (!fullUser) {
    return sendJson(res, 404, { message: "User not found." });
  }

  return sendJson(res, 200, {
    user: sanitize(fullUser),
  });
});

app.get("/auth/users", (req, res) => {
  const actor = getActor(req);

  if (actor.type !== "service" && actor.role !== "admin") {
    return sendJson(res, 403, {
      message: "Admin access is required.",
    });
  }

  return sendJson(res, 200, {
    users: store.state.users.map(sanitize),
  });
});

app.patch("/auth/users/:id/status", (req, res) => {
  const actor = getActor(req);

  if (actor.type !== "service" && actor.role !== "admin") {
    return sendJson(res, 403, {
      message: "Admin access is required.",
    });
  }

  const user = store.state.users.find((candidate) => candidate.id === req.params.id);

  if (!user) {
    return sendJson(res, 404, { message: "User not found." });
  }

  const status = String(req.body.status || "").toLowerCase();

  if (!["active", "restricted", "closed"].includes(status)) {
    return sendJson(res, 400, { message: "Status must be active, restricted, or closed." });
  }

  user.status = status;
  user.updatedAt = new Date().toISOString();
  store.save();

  return sendJson(res, 200, {
    user: sanitize(user),
  });
});

app.listen();
