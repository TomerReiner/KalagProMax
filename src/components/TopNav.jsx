import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { HardHat, CalendarDays, CalendarRange, ClipboardList, ClipboardCheck, CheckSquare, BarChart3, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreviewRole } from "@/lib/previewRoleContext";
import { useOpenTasksToday } from "@/lib/useOpenTasksToday";

const ALL_NAV_ITEMS = [
  { to: "/", label: "פערים", icon: HardHat, roles: ["admin", "קלפ", "רסר", "סגל"] },
  { to: "/daily-summary", label: "סיכום מסדר", icon: ClipboardList, roles: ["admin", "קלפ"] },
  { to: "/shotaf", label: "שוטף", icon: CalendarDays, roles: ["admin"] },
  { to: "/constraints", label: "אילוצים", icon: CalendarRange, roles: ["admin", "קלפ", "רסר", "סגל"] },
  { to: "/tasks", label: "משימות", icon: ClipboardCheck, roles: ["admin"] },
  { to: "/statistics", label: "סטטיסטיקה", icon: BarChart3, roles: ["admin", "רסר", "סגל"] },
  { to: "/klaf", label: "המשימות שלי", icon: CheckSquare, roles: ["קלפ"] },
  { to: "/equipment", label: "משיכות ציוד", icon: Package, roles: ["admin", "קלפ"] },
];

const ROLE_ORDER = {
  admin: ["/", "/daily-summary", "/equipment", "/shotaf", "/constraints", "/tasks", "/statistics"],
  קלפ: ["/klaf", "/constraints", "/", "/daily-summary", "/equipment"],
  רסר: ["/", "/statistics", "/constraints"],
  סגל: ["/", "/statistics", "/constraints"],
};

export default function TopNav() {
  const [user, setUser] = useState(null);
  const { previewRole, previewPluga } = usePreviewRole();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const effectiveRole = previewRole || user?.role;
  const targetPluga = previewRole === "קלפ" ? previewPluga : user?.pluga;
  const { openCount } = useOpenTasksToday(effectiveRole === "קלפ" ? targetPluga : null);
  const order = ROLE_ORDER[effectiveRole] || [];
  const items = ALL_NAV_ITEMS
    .filter((item) => !user || item.roles.includes(effectiveRole))
    .sort((a, b) => order.indexOf(a.to) - order.indexOf(b.to));

  return (
    <div className="bg-black text-white">
      <div className="max-w-6xl mx-auto px-2 flex items-center gap-1 overflow-x-auto">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2",
                isActive
                  ? "border-white text-white"
                  : "border-transparent text-slate-300 hover:text-white hover:border-slate-600"
              )
            }
          >
            <Icon className="w-4 h-4" />
            {label}
            {to === "/klaf" && openCount > 0 && (
              <span
                className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
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