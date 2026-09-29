import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { HardHat, CalendarDays, CalendarRange, ClipboardList, ClipboardCheck, CheckSquare, BarChart3, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreviewRole } from "@/lib/previewRoleContext";
import { useOpenTasksToday } from "@/lib/useOpenTasksToday";
import { hasAnyPermission, effectivePermissions } from "@/lib/permissions";

// Icon-only bar (labels are shown as a title/tooltip instead — see the
// NavLink below) — request: "הבאר למעלה יהיה רק אייקונים ללא טקסט".
// משיכות ציוד ("/equipment") and פלייבוקס ("/playbox") used to be nav items
// here; they moved under a single "אזור אישי" (personal area) icon/page
// instead (see src/pages/PersonalArea.jsx) — both routes still exist and
// still work, they're just reached from there now, not from this bar.
const ALL_NAV_ITEMS = [
  { to: "/", label: "פערים", icon: HardHat, roles: ["admin", "קלפ", "רסר", "סגל"] },
  { to: "/daily-summary", label: "סיכום מסדר", icon: ClipboardList, roles: ["admin", "קלפ"] },
  { to: "/shotaf", label: "שוטף", icon: CalendarDays, roles: ["admin"] },
  { to: "/constraints", label: "אילוצים", icon: CalendarRange, roles: ["admin", "קלפ", "רסר", "סגל"] },
  { to: "/tasks", label: "משימות", icon: ClipboardCheck, roles: ["admin"] },
  { to: "/statistics", label: "סטטיסטיקה", icon: BarChart3, roles: ["admin", "רסר", "סגל"] },
  // Every קלפ reaches /klaf by role; a delegated meal_regulators holder of
  // any other role reaches it too (see extraPermissionKey below), gated by
  // hasAnyPermission below rather than by role alone.
  { to: "/klaf", label: "המשימות שלי", icon: CheckSquare, roles: ["קלפ"], extraPermissionKey: "meal_regulators" },
  // Personal area: equipment withdrawals, playbox, and push-notification
  // opt-in. Visible to every signed-in user regardless of role — the page
  // itself decides which of those sub-links to actually show.
  { to: "/personal", label: "אזור אישי", icon: UserRound, roles: ["admin", "קלפ", "רסר", "סגל"] },
];

const ROLE_ORDER = {
  admin: ["/", "/daily-summary", "/shotaf", "/constraints", "/tasks", "/statistics", "/klaf", "/personal"],
  קלפ: ["/klaf", "/constraints", "/", "/daily-summary", "/personal"],
  רסר: ["/", "/statistics", "/constraints", "/klaf", "/personal"],
  סגל: ["/", "/statistics", "/constraints", "/klaf", "/personal"],
};

export default function TopNav() {
  const [user, setUser] = useState(null);
  const [myPermissions, setMyPermissions] = useState([]);
  const { previewRole, previewPluga } = usePreviewRole();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) { setMyPermissions([]); return; }
    base44.entities.UserPermission.filter({ user_id: user.id })
      .then(setMyPermissions)
      .catch(() => setMyPermissions([]));
  }, [user?.id]);

  const effectiveRole = previewRole || user?.role;
  const targetPluga = previewRole === "קלפ" ? previewPluga : user?.pluga;
  const { openCount } = useOpenTasksToday(effectiveRole === "קלפ" ? targetPluga : null);
  const order = ROLE_ORDER[effectiveRole] || [];
  // Admins hold every delegated permission automatically — use the REAL role
  // here, never the previewed one, so previewing as another role never hands
  // that role an admin's access (see effectivePermissions).
  const delegatedPermissions = effectivePermissions(myPermissions, user?.role);
  const items = ALL_NAV_ITEMS
    .filter((item) => !user || item.roles.includes(effectiveRole) || (item.extraPermissionKey && hasAnyPermission(delegatedPermissions, [item.extraPermissionKey])))
    .sort((a, b) => order.indexOf(a.to) - order.indexOf(b.to));

  return (
    <div className="bg-black text-white">
      <div className="max-w-6xl mx-auto px-2 flex items-center justify-center gap-1 overflow-x-auto">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            title={label}
            aria-label={label}
            className={({ isActive }) =>
              cn(
                "relative flex items-center justify-center px-4 py-3 transition-colors border-b-2",
                isActive
                  ? "border-white text-white"
                  : "border-transparent text-slate-300 hover:text-white hover:border-slate-600"
              )
            }
          >
            <Icon className="w-5 h-5" />
            {to === "/klaf" && openCount > 0 && (
              <span
                className="absolute top-1 left-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center"
                title={`יש לך ${openCount} משימות פתוחות היום`}
              >
                {openCount > 99 ? "99+" : openCount}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}