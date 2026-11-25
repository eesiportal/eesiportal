self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "EESI Elevators, Inc.", body: event.data ? event.data.text() : "New update" };
  }
  const title = payload.title || "EESI Elevators, Inc.";
  const body = payload.body || "";
  const vibratePattern = Array.isArray(payload.vibrate) ? payload.vibrate : [260, 110, 260, 110, 380];
  const options = {
    body,
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    vibrate: vibratePattern,
    silent: false,
    timestamp: Date.now(),
    requireInteraction: !!payload.requireInteraction,
    data: {
      threadId: payload.threadId || payload.thread_id || null,
      page: payload.page || null,
      scheduleId: payload.scheduleId || payload.schedule_id || null
    },
    tag: payload.tag || "eesi-notification",
    renotify: true,
    actions: [{ action: "open", title: "Open App" }]
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => {
          try {
            client.postMessage({
              type: "push-received",
              title,
              body,
              vibrate: vibratePattern
            });
          } catch {}
        });
      })
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = (event.notification && event.notification.data) || {};
  const threadId = data.threadId || null;
  const page = data.page || null;
  const scheduleId = data.scheduleId || null;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if (threadId) client.postMessage({ type: "open-thread", threadId });
          else if (page) client.postMessage({ type: "open-page", page, scheduleId });
          return client.focus();
        }
      }
      const targetUrl = threadId
        ? "/?thread=" + encodeURIComponent(threadId)
        : page
          ? "/?page=" + encodeURIComponent(page)
          : "/";
      return self.clients.openWindow(targetUrl);
    })
  );
});
