const { getActor } = require("../../../shared/src/auth");
const { createApp, sendJson } = require("../../../shared/src/server");
const { createId, createStore } = require("../../../shared/src/store");

const store = createStore({
  notifications: [
    {
      id: "ntf_welcome_demo",
      userId: "usr_demo_001",
      channel: "in-app",
      subject: "Welcome to LionTech Finance",
      message: "Your digital banking profile is verified and ready.",
      status: "delivered",
      read: false,
      createdAt: "2026-05-01T09:40:00.000Z",
    },
  ],
});

const app = createApp({ serviceName: "notifications-service" });

function createNotification(payload) {
  const now = new Date().toISOString();
  const notification = {
    id: createId("ntf"),
    userId: String(payload.userId || "").trim(),
    channel: String(payload.channel || "in-app").trim(),
    subject: String(payload.subject || "LionTech Finance update").trim(),
    message: String(payload.message || "").trim(),
    status: payload.status || "delivered",
    read: false,
    metadata: payload.metadata || {},
    createdAt: now,
  };

  if (!notification.userId || !notification.message) {
    const error = new Error("userId and message are required.");
    error.status = 400;
    throw error;
  }

  store.state.notifications.unshift(notification);
  store.save();
  return notification;
}

app.get("/notifications", (req, res) => {
  const actor = getActor(req);
  const requestedUserId = req.query.userId;
  const notifications =
    actor.type === "service" || actor.role === "admin"
      ? store.state.notifications.filter((notification) => !requestedUserId || notification.userId === requestedUserId)
      : store.state.notifications.filter((notification) => notification.userId === actor.id);

  return sendJson(res, 200, {
    notifications,
    unread: notifications.filter((notification) => !notification.read).length,
  });
});

app.post("/notifications", (req, res) => {
  const actor = getActor(req);

  if (actor.type !== "service" && actor.role !== "admin") {
    return sendJson(res, 403, { message: "Service or admin access is required." });
  }

  return sendJson(res, 201, {
    notification: createNotification(req.body),
  });
});

app.post("/notifications/send", (req, res) => {
  const actor = getActor(req);

  if (actor.type !== "service" && actor.role !== "admin") {
    return sendJson(res, 403, { message: "Service or admin access is required." });
  }

  return sendJson(res, 201, {
    notification: createNotification(req.body),
  });
});

app.patch("/notifications/:id/read", (req, res) => {
  const actor = getActor(req);
  const notification = store.state.notifications.find((candidate) => candidate.id === req.params.id);

  if (!notification || (actor.type === "user" && actor.role !== "admin" && notification.userId !== actor.id)) {
    return sendJson(res, 404, { message: "Notification not found." });
  }

  notification.read = true;
  notification.readAt = new Date().toISOString();
  store.save();

  return sendJson(res, 200, { notification });
});

app.listen();
