// Web Push (VAPID) opt-in/out, used from src/pages/PersonalArea.jsx. This is
// real browser push — a subscribed user gets an actual OS notification (see
// public/sw.js), including while the site isn't open, which is what makes it
// "jump" on the phone the way the feature request asked for.
//
// Platform reality (can't be worked around, only explained to the user):
//  - Android / desktop Chrome, Edge, Firefox: works directly, no install step.
//  - iOS Safari: Apple only delivers Web Push to a site the person has
//    already added to their Home Screen (Settings aren't enough — it must be
//    opened as that installed icon at least once). This is a hard iOS
//    platform restriction, not a bug here. isIosNonStandalone() below lets
//    the UI explain this instead of just failing silently.
import { base44 } from "@/api/base44Client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function isPushSupported() {
  return typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
}

// iOS Safari only accepts push for a site running as an installed
// Home-Screen PWA (display-mode: standalone) — not from an ordinary Safari
// tab, however "supported" the raw APIs look.
export function isIosNonStandalone() {
  if (typeof navigator === "undefined") return false;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS reports as Mac
  const isStandalone = window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  return isIos && !isStandalone;
}

export function getPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function registerServiceWorker() {
  return navigator.serviceWorker.register("/sw.js");
}

export async function getExistingSubscription() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

// Registers the service worker (if needed), asks for notification
// permission, subscribes with the browser's push service, and saves the
// resulting subscription server-side (api/push-subscribe.js) so the daily
// 7:00 job and admin announcements can actually reach this device.
export async function subscribeToPush() {
  if (!isPushSupported()) {
    throw new Error("הדפדפן הזה לא תומך בהתראות Push");
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("VITE_VAPID_PUBLIC_KEY לא מוגדר — יש להגדיר משתני סביבה (ראו README-SUPABASE.md)");
  }
  const registration = await registerServiceWorker();
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(permission === "denied" ? "ההרשאה להתראות נדחתה בדפדפן" : "לא ניתנה הרשאה להתראות");
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await base44.functions.invoke("pushSubscribe", { subscription: subscription.toJSON() });
  return subscription;
}

export async function unsubscribeFromPush() {
  const subscription = await getExistingSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await base44.functions.invoke("pushUnsubscribe", { endpoint }).catch(() => {
    // Best-effort — the subscription is already gone from the browser side,
    // which is what matters most to the person clicking "בטל".
  });
}
