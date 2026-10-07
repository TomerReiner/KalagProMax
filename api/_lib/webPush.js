import webpush from 'web-push';

// Shared Web Push sender for the two things that push notifications:
// api/send-daily-tasks-push.js (7:00 daily reminder, Vercel Cron) and
// api/publish-announcement.js (admin broadcast, see supabase/migrations/
// 0016_announcements_and_push.sql). Both need the same VAPID setup and the
// same "a dead subscription should get cleaned out of the table" handling,
// so it lives here once instead of twice.

let configured = false;
function ensureConfigured() {
  if (configured) return;
  // Mirrors the VITE_-prefixed/plain pairing api/_lib/supabaseAdmin.js
  // already uses for the Supabase URL: the *public* VAPID key is also
  // exposed to the browser as VITE_VAPID_PUBLIC_KEY (see
  // src/lib/pushNotifications.js), so it's set twice in Vercel's env vars —
  // once with the VITE_ prefix for the client bundle, once without for
  // server functions. The private key is server-only and must never get a
  // VITE_ prefix.
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
  if (!publicKey || !privateKey) {
    throw new Error('Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY environment variables (set them in Vercel project settings — see README-SUPABASE.md).');
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

// `subscriptions` are push_subscriptions rows ({ endpoint, p256dh, auth,
// ... }). `payload` is whatever public/sw.js's 'push' handler expects
// ({ title, body, url, tag? }). Subscriptions the push service reports as
// gone (410 Gone / 404 Not Found — the browser unsubscribed, cleared site
// data, or the device was reset) are deleted from push_subscriptions so
// future sends don't keep retrying them.
export async function sendPushToSubscriptions(supabaseAdmin, subscriptions, payload) {
  if (!subscriptions.length) return { sent: 0, removed: 0 };
  ensureConfigured();
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      )
    )
  );
  const deadEndpoints = [];
  let sent = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      sent += 1;
    } else {
      const statusCode = r.reason?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        deadEndpoints.push(subscriptions[i].endpoint);
      }
    }
  });
  if (deadEndpoints.length > 0) {
    await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', deadEndpoints);
  }
  return { sent, removed: deadEndpoints.length };
}
