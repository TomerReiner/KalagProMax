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
// ההתראות כדיפולטית") instead of requiring someone to discover and click the
// manual toggle in "אזור אישי" (src/pages/PersonalArea.jsx, which stays as
// the manual fallback/off-switch — this is also why the previous "only the
// person who published an announcement got the push" report wasn't really a
// delivery bug: api/publish-announcement.js already pushes to every row in
// push_subscriptions with no filtering, see that file — nobody else had
// subscribed yet). Mounted once in AppLayout.jsx so it runs regardless of
// which page someone lands on after signing in.
//
// The one thing this can't do anything about: the actual OS/browser
// permission popup itself always needs a person to click "Allow" — no code
// can skip that, by design of the Notification API. iOS Safari's stricter
// "must be added to Home Screen first" restriction (isIosNonStandalone) is
// likewise a hard platform limit, not something this can route around — see
// src/lib/pushNotifications.js.
export default function PushAutoSubscribe({ user }) {
  const { toast } = useToast();
  const attempted = useRef(false);

  useEffect(() => {
    if (!user || attempted.current) return;
    if (!isPushSupported() || isIosNonStandalone()) return;
    if (getPermission() !== "default") return; // already decided (granted or denied) — nothing to auto-do

    let cancelled = false;
    (async () => {
      try {
        let lastAttempt = 0;
        try {
          lastAttempt = Number(localStorage.getItem(STORAGE_KEY) || 0);
        } catch {
          // Private-browsing / blocked storage — just proceed as if this is
          // the first attempt; worst case it asks again next reload.
        }
        if (Date.now() - lastAttempt < RETRY_AFTER_MS) return;

        const existing = await getExistingSubscription();
        if (existing || cancelled) return;

        attempted.current = true;
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
        // Silent on purpose: this ran without the person asking for it (it's
        // the "default on" behavior, not a button they clicked), so failing
        // loudly here would be more surprising than helpful. Most likely
        // cause is a browser that requires a user gesture before it'll show
        // the permission prompt, or the person dismissed/denied it — either
        // way they can still turn it on manually from "אזור אישי".
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, toast]);

  return null;
}
