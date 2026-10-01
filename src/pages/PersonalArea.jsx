import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Bell, BellOff, BellRing, Info, ChevronLeft } from "lucide-react";
import { usePreviewRole } from "@/lib/previewRoleContext";
import { effectivePermissions } from "@/lib/permissions";
import { getPersonalAreaLinks } from "@/lib/personalAreaLinks";
import {
  isPushSupported,
  isIosNonStandalone,
  getPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getExistingSubscription,
} from "@/lib/pushNotifications";
import { useToast } from "@/components/ui/use-toast";

// "אזור אישי" — the new home for what used to be their own top-nav items
// (משיכות ציוד / פלייבוקס, see TopNav.jsx), now that the top bar is
// icon-only, plus per-device Web Push opt-in (feature: real phone
// notifications for the 7:00 daily task reminder and admin announcements).
export default function PersonalArea() {
  const [user, setUser] = useState(null);
  const [myPermissions, setMyPermissions] = useState([]);
  const { previewRole } = usePreviewRole();
  const { toast } = useToast();

  const [pushBusy, setPushBusy] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [checkingPush, setCheckingPush] = useState(true);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) { setMyPermissions([]); return; }
    base44.entities.UserPermission.filter({ user_id: user.id }).then(setMyPermissions).catch(() => setMyPermissions([]));
  }, [user?.id]);

  const refreshPushStatus = useCallback(async () => {
    setCheckingPush(true);
    try {
      const sub = await getExistingSubscription();
      setPushSubscribed(!!sub);
    } finally {
      setCheckingPush(false);
    }
  }, []);

  useEffect(() => {
    if (isPushSupported()) refreshPushStatus();
    else setCheckingPush(false);
  }, [refreshPushStatus]);

  const handleTogglePush = async () => {
    setPushBusy(true);
    try {
      if (pushSubscribed) {
        await unsubscribeFromPush();
        setPushSubscribed(false);
        toast({ title: "התראות בוטלו במכשיר זה", duration: 2500 });
      } else {
        await subscribeToPush();
        setPushSubscribed(true);
        toast({ title: "התראות הופעלו במכשיר זה", duration: 2500 });
      }
    } catch (err) {
      toast({ title: "שגיאה בהגדרת התראות", description: err.message, variant: "destructive" });
    } finally {
      setPushBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const effectiveRole = previewRole || user.role;
  // During a role preview this intentionally passes the previewed role, not
  // the real (admin) one, so an admin previewing e.g. "תצוגת רסר" sees
  // exactly the links a plain רסר would — not every permission-gated link,
  // just because the real signed-in user happens to be an admin (see the
  // doc comment on effectivePermissions in src/lib/permissions.js).
  const delegatedPermissions = effectivePermissions(myPermissions, effectiveRole);
  const links = getPersonalAreaLinks({ effectiveRole, delegatedPermissions });

  const notifPermission = getPermission();
  const iosBlocked = isIosNonStandalone();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">אזור אישי</h1>
        <p className="text-sm text-muted-foreground">קישורים אישיים והגדרות התראות</p>
      </div>

      <div className="space-y-3">
        {links.map(({ to, label, description, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center justify-between gap-3 rounded-xl border-2 border-border bg-white p-4 hover:border-slate-400 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </Link>
        ))}
        {links.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">אין קישורים נוספים זמינים עבורך כרגע</p>
        )}
      </div>

      <div className="rounded-xl border-2 border-border bg-white p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BellRing className="w-4 h-4 text-slate-700" />
          <p className="font-medium text-sm">התראות פוש למכשיר זה</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          כשמופעל, תקבלו התראה ישירות לטלפון/למחשב כשיש הודעה חדשה מהמנהלים, וכל בוקר ב-7:00 תזכורת על המשימות שלכם להיום.
        </p>

        {!isPushSupported() && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>הדפדפן הזה לא תומך בהתראות Push.</span>
          </div>
        )}

        {isPushSupported() && iosBlocked && (
          <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              ב-iPhone/iPad יש קודם להוסיף את האתר למסך הבית (כפתור השיתוף ⇦ "הוסף למסך הבית"), ולפתוח אותו מהאייקון שנוסף שם — רק אז ניתן להפעיל התראות (מגבלה של אפל, לא ניתנת לעקיפה).
            </span>
          </div>
        )}

        {isPushSupported() && !iosBlocked && notifPermission === "denied" && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>ההרשאה להתראות נחסמה בדפדפן. יש לאפשר התראות עבור האתר הזה בהגדרות הדפדפן כדי להפעיל.</span>
          </div>
        )}

        {isPushSupported() && !iosBlocked && (
          <Button
            onClick={handleTogglePush}
            disabled={pushBusy || checkingPush || notifPermission === "denied"}
            variant={pushSubscribed ? "outline" : "default"}
            className="w-full gap-2"
          >
            {pushBusy || checkingPush ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : pushSubscribed ? (
              <BellOff className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            {checkingPush ? "בודק..." : pushSubscribed ? "בטל התראות במכשיר זה" : "הפעל התראות במכשיר זה"}
          </Button>
        )}
      </div>
    </div>
  );
}
