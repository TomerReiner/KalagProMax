import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, ChevronLeft } from "lucide-react";
import { usePreviewRole } from "@/lib/previewRoleContext";
import { effectivePermissions } from "@/lib/permissions";
import { getPersonalAreaLinks } from "@/lib/personalAreaLinks";

// "אזור אישי" — the new home for what used to be their own top-nav items
// (משיכות ציוד / פלייבוקס, see TopNav.jsx), now that the top bar is
// icon-only.
//
// This used to also have a manual "התראות פוש למכשיר זה" on/off card here
// (isPushSupported / isIosNonStandalone / subscribeToPush / etc. from
// src/lib/pushNotifications.js). Removed per feature request ("נמחק את
// התראות פוש למכשיר זה באזור האישי") now that subscribing already happens
// automatically on the first tap/click anywhere in the app instead (see
// src/components/PushAutoSubscribe.jsx, mounted globally in AppLayout.jsx)
// — there's no on/off switch left anywhere in the app for this. Someone who
// really wants to stop push notifications for this site still can, the
// normal browser way: turning off notification permission for the site in
// the browser/OS's own site settings (which getPermission() in
// pushNotifications.js would then read back as "denied").
export default function PersonalArea() {
  const [user, setUser] = useState(null);
  const [myPermissions, setMyPermissions] = useState([]);
  const { previewRole } = usePreviewRole();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) { setMyPermissions([]); return; }
    base44.entities.UserPermission.filter({ user_id: user.id }).then(setMyPermissions).catch(() => setMyPermissions([]));
  }, [user?.id]);

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

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">אזור אישי</h1>
        <p className="text-sm text-muted-foreground">קישורים אישיים</p>
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
    </div>
  );
}
