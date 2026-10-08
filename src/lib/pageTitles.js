// Per-page title shown in AppLayout.jsx right under the top nav, so it's
// always clear which tab you're on — separate from TopNav.jsx's own
// ALL_NAV_ITEMS because it also needs entries for "/equipment" and
// "/playbox", which stopped being nav items themselves once they moved under
// "אזור אישי" (see TopNav.jsx) but are still real pages people land on.
//
// "/shotaf" is gone — src/pages/Shotaf.jsx's content moved into
// "/daily-summary" as a second tab (see src/pages/DailySummary.jsx), so the
// two pages that used to each have their own title now share one.
import { HardHat, CalendarRange, ClipboardList, ClipboardCheck, CheckSquare, BarChart3, UserRound, Package, Truck, UtensilsCrossed, Radar, BookUser, LifeBuoy, Printer } from "lucide-react";

export const PAGE_TITLES = {
  "/overview": { label: "תמונת מצב", icon: Radar },
  "/": { label: "פערים", icon: HardHat },
  "/daily-summary": { label: "שוטף", icon: ClipboardList },
  "/constraints": { label: "אילוצים", icon: CalendarRange },
  "/tasks": { label: "משימות", icon: ClipboardCheck },
  "/statistics": { label: "סטטיסטיקה", icon: BarChart3 },
  "/klaf": { label: "המשימות שלי", icon: CheckSquare },
  "/personal": { label: "אזור אישי", icon: UserRound },
  "/equipment": { label: "משיכות ציוד", icon: Package },
  "/playbox": { label: "פלייבוקס", icon: Truck },
  "/meal-regulators": { label: "מווסתים", icon: UtensilsCrossed },
  "/directory": { label: "ספר קשר", icon: BookUser },
  "/guide": { label: "מדריך ומה חדש", icon: LifeBuoy },
  "/print/week": { label: "לוח שבועי להדפסה", icon: Printer },
};
