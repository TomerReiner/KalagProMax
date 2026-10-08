// Which routes each role may open, and where each role lands after login.
// Shared by AppLayout.jsx (route guard), the global search
// (src/components/CommandPalette.jsx — only offers pages you can open) and
// anything else that needs to know "can this role reach that page".
//
// Notes per route:
//  - "/overview" (תמונת מצב) — the battalion command picture; home page for
//    admin / רסר / סגל.
//  - "/meal-regulators" is open to every role: everyone can see the day's
//    filled-in regulators; what each person can EDIT there is decided on the
//    page itself (src/lib/mealRegulators.js).
//  - "/daily-summary" (tab label "שוטף") is open to every role: the שוטף tab
//    is edit-gated by shotaf_schedule, סיכום מסדר is open to all.
//  - "/playbox" is open to every role: anyone can create/edit an order; only
//    approval/status changes are gated (src/pages/Playbox.jsx).
//  - "/personal", "/directory" (ספר קשר), "/guide" (מדריך) and
//    "/print/week" (לוח שבועי להדפסה) are open to all.
//  - "/equipment" is admin/קלפ only.
const SHARED = ["/", "/daily-summary", "/constraints", "/playbox", "/meal-regulators", "/personal", "/directory", "/guide", "/print/week"];

export const ROLE_PAGES = {
  admin: ["/overview", ...SHARED, "/tasks", "/statistics", "/equipment"],
  קלפ: [...SHARED, "/klaf", "/equipment"],
  רסר: ["/overview", ...SHARED, "/statistics"],
  סגל: ["/overview", ...SHARED, "/statistics"],
};

export const ROLE_DEFAULT_PAGE = {
  admin: "/overview",
  קלפ: "/klaf",
  רסר: "/overview",
  סגל: "/overview",
};

export function canOpenPage(role, path) {
  return (ROLE_PAGES[role] || []).includes(path.split("?")[0].split("#")[0]);
}
