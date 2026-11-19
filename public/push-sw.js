self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "EESI Ops", body: event.data ? event.data.text() : "New update" };
  }
  const title = payload.title || "EESI Ops";
  const options = {
    body: payload.body || "",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    data: {
      threadId: payload.threadId || payload.thread_id || null,
      page: payload.page || null,
      scheduleId: payload.scheduleId || payload.schedule_id || null
    },
    tag: payload.tag || "eesi-notification",
    renotify: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
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
