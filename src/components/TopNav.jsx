import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { HardHat, CalendarRange, ClipboardList, ClipboardCheck, CheckSquare, BarChart3, UserRound, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreviewRole } from "@/lib/previewRoleContext";
import { useOpenTasksToday } from "@/lib/useOpenTasksToday";
import { effectivePermissions } from "@/lib/permissions";
import { getPersonalAreaLinks } from "@/lib/personalAreaLinks";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

// Icon-only bar (labels are shown as a title/tooltip instead — see the
// NavLink below) — request: "הבאר למעלה יהיה רק אייקונים ללא טקסט".
// משיכות ציוד ("/equipment"), פלייבוקס ("/playbox") and מווסתים ("/klaf"'s
// isDelegatedOnly view, for a non-קלפ holder) used to be — or could only ever
// be — reached from their own top-nav items; they all live under a single
// "אזור אישי" (personal area) icon now instead (see src/lib/personalAreaLinks.js
// / src/pages/PersonalArea.jsx) — every route still exists and still works,
// it's just reached from there (or from this icon's own mini-menu, see
// PERSONAL_AREA_ITEM below) rather than its own bar icon.
// "/shotaf" is gone as a nav item entirely — its page merged into
// "/daily-summary" as a second tab (see src/pages/DailySummary.jsx).
const ALL_NAV_ITEMS = [
  { to: "/", label: "פערים", icon: HardHat, roles: ["admin", "קלפ", "רסר", "סגל"] },
  { to: "/daily-summary", label: "סיכום מסדר ושוטף", icon: ClipboardList, roles: ["admin", "קלפ", "רסר", "סגל"] },
  { to: "/constraints", label: "אילוצים", icon: CalendarRange, roles: ["admin", "קלפ", "רסר", "סגל"] },
  { to: "/tasks", label: "משימות", icon: ClipboardCheck, roles: ["admin"] },
  { to: "/statistics", label: "סטטיסטיקה", icon: BarChart3, roles: ["admin", "רסר", "סגל"] },
  // Every קלפ reaches /klaf by role — a delegated meal_regulators holder of
  // any OTHER role no longer gets this icon at all; they reach the same
  // route's narrower "מווסתים" view through the personal-area mini-menu
  // below instead (see getPersonalAreaLinks).
  { to: "/klaf", label: "המשימות שלי", icon: CheckSquare, roles: ["קלפ"] },
];

// Rendered as its own dropdown-menu trigger below, not a plain NavLink —
// kept out of ALL_NAV_ITEMS since it behaves differently (opens a menu
// instead of navigating straight there on click — feature request: "בלחיצה
// על הכפתור של אזור אישי ייפתח מיני menu עם האפשרויות").
const PERSONAL_AREA_ITEM = { to: "/personal", label: "אזור אישי", icon: UserRound };

const ROLE_ORDER = {
  admin: ["/", "/daily-summary", "/constraints", "/tasks", "/statistics", "/klaf", "/personal"],
  קלפ: ["/klaf", "/constraints", "/", "/daily-summary", "/personal"],
  רסר: ["/", "/statistics", "/constraints", "/daily-summary", "/klaf", "/personal"],
  סגל: ["/", "/statistics", "/constraints", "/daily-summary", "/klaf", "/personal"],
};

// Shared active/inactive pill styling for both the plain NavLinks and the
// personal-area dropdown trigger, so the dropdown's own "is a personal-area
// route currently open" state looks exactly like every other tab's active
// state (inspired by a reference screenshot of another in-house tool's
// toolbar: a rounded pill highlight on the active tab rather than the
// previous bottom-border underline). Stacked icon-over-label layout — same
// screenshot also shows a small text label under each icon, not icon-only;
// the label uses NAV_LABEL_CLASS below and truncates instead of wrapping so
// a long label (e.g. "סיכום מסדר ושוטף") can't bring back the overflow bug
// the icon-only bar was originally built to fix.
const TAB_CLASS = (isActive) =>
  cn(
    "relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 py-2 sm:px-2 sm:py-2.5 m-1 rounded-lg transition-colors",
    isActive ? "bg-white/15 text-white" : "text-slate-300 hover:text-white hover:bg-white/5"
  );

const NAV_LABEL_CLASS = "text-[9px] sm:text-[10px] leading-tight max-w-full truncate";

export default function TopNav() {
  const [user, setUser] = useState(null);
  const [myPermissions, setMyPermissions] = useState([]);
  const { previewRole, previewPluga } = usePreviewRole();
  const location = useLocation();
  const navigate = useNavigate();

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
  // During a role preview this intentionally passes the previewed role, not
  // the real (admin) one, so the personal-area mini-menu shows exactly the
  // links a plain member of that role would see (see the doc comment on
  // effectivePermissions in src/lib/permissions.js).
  const delegatedPermissions = effectivePermissions(myPermissions, effectiveRole);
  const items = ALL_NAV_ITEMS
    .filter((item) => !user || item.roles.includes(effectiveRole))
    .sort((a, b) => order.indexOf(a.to) - order.indexOf(b.to));

  const personalLinks = getPersonalAreaLinks({ effectiveRole, delegatedPermissions });
  const isPersonalAreaActive = location.pathname === "/personal" || personalLinks.some((l) => l.to === location.pathname);

  return (
    <div className="bg-black text-white">
      {/* No overflow-x-auto / horizontal scroll on purpose — every icon
          shares the bar equally (flex-1) and shrinks to fit any phone width
          instead of spilling off-screen. */}
      <div className="max-w-6xl mx-auto flex items-stretch">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            title={label}
            aria-label={label}
            className={({ isActive }) => TAB_CLASS(isActive)}
          >
            <Icon className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
            <span className={NAV_LABEL_CLASS}>{label}</span>
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
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title={PERSONAL_AREA_ITEM.label}
                aria-label={PERSONAL_AREA_ITEM.label}
                className={TAB_CLASS(isPersonalAreaActive)}
              >
                <PERSONAL_AREA_ITEM.icon className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
                <span className={cn(NAV_LABEL_CLASS, "flex items-center gap-0.5")}>
                  {PERSONAL_AREA_ITEM.label}
                  {/* Signals this icon opens a menu instead of navigating
                      straight there — same cue the reference screenshot's own
                      "האזור שלי" item uses. */}
                  <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" dir="rtl">
              {personalLinks.map(({ to, label, icon: Icon }) => (
                <DropdownMenuItem key={to} onSelect={() => navigate(to)} className="gap-2 cursor-pointer">
                  <Icon className="w-4 h-4 text-slate-500" />
                  {label}
                </DropdownMenuItem>
              ))}
              {personalLinks.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onSelect={() => navigate("/personal")} className="gap-2 cursor-pointer">
                <PERSONAL_AREA_ITEM.icon className="w-4 h-4 text-slate-500" />
                אזור אישי מלא והתראות
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
