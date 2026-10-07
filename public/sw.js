// Service worker for Web Push notifications only (no offline caching — this
// app always wants fresh data, so there's no fetch handler here). Registered
// from src/lib/pushNotifications.js at the site root ("/sw.js"), which gives
// it scope over the whole origin.
//
// Two jobs:
//  1. 'push' — the browser woke this worker up because a push message
//     arrived (sent server-side via web-push, see api/send-daily-tasks-push.js
//     and api/publish-announcement.js). Show it as a real OS notification —
//     this is what makes it "jump" on the phone, not just inside the app.
//  2. 'notificationclick' — focus an already-open tab on this origin if one
//     exists, otherwise open a new one, navigating to the URL the payload
//     asked for (e.g. straight to /klaf for a daily-tasks reminder).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "התראה", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Binder Done That";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/98fcd8299_image.png",
    badge: payload.badge || "https://media.base44.com/images/public/6aa1c4c872f2848a151a92bf/98fcd8299_image.png",
    dir: "rtl",
    lang: "he",
    data: { url: payload.url || "/" },
    tag: payload.tag || undefined,
    renotify: !!payload.tag,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
