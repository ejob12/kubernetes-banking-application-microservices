const { getActor, requireUser } = require("../../../shared/src/auth");
const { createApp, sendJson } = require("../../../shared/src/server");
const { createStore } = require("../../../shared/src/store");

const store = createStore({
  profiles: [
    {
      userId: "usr_demo_001",
      legalName: "LionTech Demo Client",
      preferredName: "Demo",
      dateOfBirth: "1992-08-14",
      address: "120 Brickell Avenue, Miami, FL",
      country: "United States",
      occupation: "Cloud Engineer",
      employer: "LionTech Academy",
      phone: "+1 305 555 0188",
      kycStatus: "verified",
      riskTier: "standard",
      createdAt: "2026-05-01T09:15:00.000Z",
    },
  ],
});

const app = createApp({ serviceName: "profile-service" });

function upsertProfile(userId, payload) {
  const existing = store.state.profiles.find((profile) => profile.userId === userId);
  const now = new Date().toISOString();
  const values = {
    legalName: String(payload.legalName || payload.name || "").trim(),
    preferredName: String(payload.preferredName || "").trim(),
    dateOfBirth: String(payload.dateOfBirth || "").trim(),
    address: String(payload.address || "").trim(),
    country: String(payload.country || "").trim(),
    occupation: String(payload.occupation || "").trim(),
    employer: String(payload.employer || "").trim(),
    phone: String(payload.phone || "").trim(),
  };

  if (!values.legalName || !values.address || !values.country || !values.phone) {
    const error = new Error("Legal name, address, country, and phone are required.");
    error.status = 400;
    throw error;
  }

  if (existing) {
    Object.assign(existing, values, {
      updatedAt: now,
    });
    return existing;
  }

  const profile = {
    userId,
    ...values,
    kycStatus: "pending",
    riskTier: "standard",
    createdAt: now,
  };

  store.state.profiles.push(profile);
  return profile;
}

app.get("/profiles", (req, res) => {
  const actor = getActor(req);

  if (actor.type !== "service" && actor.role !== "admin") {
    return sendJson(res, 403, { message: "Admin access is required." });
  }

  return sendJson(res, 200, {
    profiles: store.state.profiles,
  });
});

app.get("/profiles/me", (req, res) => {
  const user = requireUser(req);
  const profile = store.state.profiles.find((candidate) => candidate.userId === user.id);

  return sendJson(res, 200, {
    profile: profile || null,
  });
});

app.post("/profiles/me", (req, res) => {
  const user = requireUser(req);
  const profile = upsertProfile(user.id, req.body);

  store.save();
  return sendJson(res, 200, { profile });
});

app.patch("/profiles/me", (req, res) => {
  const user = requireUser(req);
  const profile = upsertProfile(user.id, req.body);

  store.save();
  return sendJson(res, 200, { profile });
});

app.get("/profiles/:userId", (req, res) => {
  const actor = getActor(req);
  const isOwner = actor.type === "user" && actor.id === req.params.userId;

  if (!isOwner && actor.type !== "service" && actor.role !== "admin") {
    return sendJson(res, 403, { message: "You can only view your own profile." });
  }

  const profile = store.state.profiles.find((candidate) => candidate.userId === req.params.userId);

  if (!profile) {
    return sendJson(res, 404, { message: "Profile not found." });
  }

  return sendJson(res, 200, { profile });
});

app.patch("/profiles/:userId/kyc", (req, res) => {
  const actor = getActor(req);

  if (actor.type !== "service" && actor.role !== "admin") {
    return sendJson(res, 403, { message: "Admin access is required." });
  }

  const profile = store.state.profiles.find((candidate) => candidate.userId === req.params.userId);

  if (!profile) {
    return sendJson(res, 404, { message: "Profile not found." });
  }

  const kycStatus = String(req.body.kycStatus || "").toLowerCase();
  const riskTier = String(req.body.riskTier || profile.riskTier).toLowerCase();

  if (!["pending", "verified", "review", "declined"].includes(kycStatus)) {
    return sendJson(res, 400, { message: "Invalid KYC status." });
  }

  profile.kycStatus = kycStatus;
  profile.riskTier = ["low", "standard", "elevated", "high"].includes(riskTier) ? riskTier : profile.riskTier;
  profile.updatedAt = new Date().toISOString();
  store.save();

  return sendJson(res, 200, { profile });
});

app.listen();
