import { useEffect, useRef } from "react";
import {
  isPushSupported,
  isIosNonStandalone,
  getPermission,
  getExistingSubscription,
  subscribeToPush,
} from "@/lib/pushNotifications";
import { useToast } from "@/components/ui/use-toast";

const STORAGE_KEY = "push_auto_prompt_at_v1";
// Don't hammer the browser's permission API on every reload if an attempt
// silently didn't go through (e.g. this browser requires a user gesture the
// automatic call didn't have) or the person just hasn't decided yet —
// retry at most once a day until it actually succeeds or gets denied.
const RETRY_AFTER_MS = 24 * 60 * 60 * 1000;

// Makes push notifications on-by-default (feature request: "נגדיר את שליחת
// ההתראות כדיפולטית" / "שהתראות פוש נשלחות דיפולטית לכולם - לא צריך להדליק
// את זה באפליקציה") instead of requiring someone to discover and click the
// manual toggle in "אזור אישי" (src/pages/PersonalArea.jsx, which stays as
// the manual fallback/off-switch — this is also why the previous "only the
// person who published an announcement got the push" report wasn't really a
// delivery bug: api/publish-announcement.js already pushes to every row in
// push_subscriptions with no filtering, see that file — nobody else had
// subscribed yet). Mounted once in AppLayout.jsx so it runs regardless of
// which page someone lands on after signing in.
//
// Why this waits for a click instead of firing immediately on mount (the
// first version of this did): Safari and Firefox outright REFUSE to show the
// permission popup at all — no prompt, just an error — when
// Notification.requestPermission() is called outside a genuine user gesture
// (a click/tap handler). Calling it straight from a useEffect on page load,
// like before, has no gesture behind it, so on those two browsers it was
// silently failing every single time (caught by the catch block below) and
// the person would never see the prompt at all — "default on" wasn't
// actually reaching them. Chrome happens to allow it without a gesture, but
// there's no reason to special-case that.
//
// The fix: don't wait for the person to find a button — just wait for
// whatever they tap/click FIRST after signing in, anywhere in the app (a nav
// icon, a task, anything), and fire the real request from inside that
// handler. That counts as a user gesture on every browser, so the popup
// actually shows up on Safari and Firefox too, with no extra step for the
// person to take or discover. The one thing that still can't be skipped,
// anywhere: the person clicking "Allow" on the OS/browser's own popup —
// that's a hard security boundary, not something any code can route around.
// iOS Safari's separate "must be added to Home Screen first" restriction
// (isIosNonStandalone) is the same kind of hard platform limit — see
// src/lib/pushNotifications.js.
export default function PushAutoSubscribe({ user }) {
  const { toast } = useToast();
  const attempted = useRef(false);

  useEffect(() => {
    if (!user || attempted.current) return;
    if (!isPushSupported() || isIosNonStandalone()) return;
    if (getPermission() !== "default") return; // already decided (granted or denied) — nothing to auto-do

    let lastAttempt = 0;
    try {
      lastAttempt = Number(localStorage.getItem(STORAGE_KEY) || 0);
    } catch {
      // Private-browsing / blocked storage — just proceed as if this is the
      // first attempt; worst case it asks again next reload.
    }
    if (Date.now() - lastAttempt < RETRY_AFTER_MS) return;

    attempted.current = true;
    let cancelled = false;

    // capture:true so this fires even if some inner element stops
    // propagation on its own click handler before it bubbles up.
    const onFirstInteraction = async () => {
      if (cancelled) return;
      try {
        const existing = await getExistingSubscription();
        if (existing || cancelled) return;

        try {
          localStorage.setItem(STORAGE_KEY, String(Date.now()));
        } catch {
          // ignore — see above
        }
        await subscribeToPush();
        if (!cancelled) {
          toast({
            title: "התראות הופעלו אוטומטית במכשיר זה",
            description: "אפשר לבטל בכל עת ב\"אזור אישי\"",
            duration: 4000,
          });
        }
      } catch {
        // Silent on purpose: this ran without the person deliberately asking
        // for it (it's the "default on" behavior, not a button they
        // clicked), so failing loudly here would be more surprising than
        // helpful. Most likely cause is the person dismissing/denying the
        // popup — either way they can still turn it on manually from
        // "אזור אישי".
      }
    };

    document.addEventListener("pointerdown", onFirstInteraction, { capture: true, once: true });

    return () => {
      cancelled = true;
      document.removeEventListener("pointerdown", onFirstInteraction, true);
    };
  }, [user, toast]);

  return null;
}
