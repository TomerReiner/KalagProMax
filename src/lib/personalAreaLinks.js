// Shared "אזור אישי" link list — used by both the full /personal page
// (src/pages/PersonalArea.jsx, which renders them as cards) and TopNav's
// compact dropdown menu (src/components/TopNav.jsx's mini-menu, see the
// personal-area feature request), so the two stay in sync automatically
// instead of drifting apart the way some other duplicated screens in this
// app have (e.g. src/pages/DailySummary.jsx vs
// src/components/klaf/KlafSummary.jsx's entryAreas() helper).
import { Package, Truck, UtensilsCrossed } from "lucide-react";
import { hasAnyPermission, plugotFor } from "./permissions";

// `effectiveRole`/`delegatedPermissions` should already be previewRole-aware
// (see src/lib/permissions.js's effectivePermissions doc comment) so the
// links shown during a role preview match what that role would really see.
export function getPersonalAreaLinks({ effectiveRole, delegatedPermissions }) {
  const links = [];

  // Same visibility rule /equipment had as a top-nav item before it moved
  // here — admin/קלפ only (AppLayout's ROLE_PAGES allowlist still enforces
  // this at the route level regardless).
  if (effectiveRole === "admin" || effectiveRole === "קלפ") {
    links.push({
      to: "/equipment",
      label: "משיכות ציוד",
      description: "מעקב אחר ציוד ובקשות משיכה",
      icon: Package,
    });
  }

  // Open to everyone — anyone can create/edit an order; approving it is
  // what needs playbox_orders (see src/pages/Playbox.jsx).
  links.push({
    to: "/playbox",
    label: "פלייבוקס",
    description: hasAnyPermission(delegatedPermissions, ["playbox_orders"]) ? "הזמנות ואישורן" : "יצירה ומעקב של הזמנות",
    icon: Truck,
  });

  // מווסתים: only for a non-קלפ delegated meal_regulators holder — a real
  // קלפ already sees their pluga's meal-regulators breakdown embedded at the
  // bottom of their own /klaf page (see src/pages/Klaf.jsx's
  // MealRegulatorsBreakdown), so a second entry point here would be
  // redundant for them. Reuses /klaf's existing isDelegatedOnly view rather
  // than a new route.
  if (effectiveRole !== "קלפ" && plugotFor(delegatedPermissions, "meal_regulators").length > 0) {
    links.push({
      to: "/klaf",
      label: "מווסתים",
      description: "ניהול רשימת המווסתים לארוחות",
      icon: UtensilsCrossed,
    });
  }

  return links;
}
