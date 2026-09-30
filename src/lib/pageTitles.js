// Per-page title shown in AppLayout.jsx right under the top nav, so it's
// always clear which tab you're on — separate from TopNav.jsx's own
// ALL_NAV_ITEMS because it also needs entries for "/equipment" and
// "/playbox", which stopped being nav items themselves once they moved under
// "אזור אישי" (see TopNav.jsx) but are still real pages people land on.
import { HardHat, CalendarDays, CalendarRange, ClipboardList, ClipboardCheck, CheckSquare, BarChart3, UserRound, Package, Truck } from "lucide-react";

export const PAGE_TITLES = {
  "/": { label: "פערים", icon: HardHat },
  "/daily-summary": { label: "סיכום מסדר", icon: ClipboardList },
  "/shotaf": { label: "שוטף", icon: CalendarDays },
  "/constraints": { label: "אילוצים", icon: CalendarRange },
  "/tasks": { label: "משימות", icon: ClipboardCheck },
  "/statistics": { label: "סטטיסטיקה", icon: BarChart3 },
  "/klaf": { label: "המשימות שלי", icon: CheckSquare },
  "/personal": { label: "אזור אישי", icon: UserRound },
  "/equipment": { label: "משיכות ציוד", icon: Package },
  "/playbox": { label: "פלייבוקס", icon: Truck },
};
