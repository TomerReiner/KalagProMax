// Delegated-permissions feature: admins can grant any of these capability
// keys to any user, independent of role (see AdminPanel's "הרשאות" section
// and supabase/migrations/0005_delegated_permissions.sql).
//
// Storage: one user_permissions row = one (user_id, permission, pluga) grant.
// `scoped: true` permissions are granted per-pluga — the SAME permission can
// be granted for several plugot at once by creating several rows (e.g.
// frisa_pina for both פארן and בשור), never by an array column. `scoped:
// false` permissions are global and stored with pluga = null.
//
// Equipment withdrawal ("משיכת ציוד") USED to be its own personal-flag
// column, profiles.equipment_manager, kept separate from this table to avoid
// touching working code — it was already doing exactly what this table does
// (a personal flag, independent of role), just via its own column instead of
// a user_permissions row. It's now folded in as the "equipment_manager" key
// below, so it lives in the same "הרשאות מיוחדות" section/UI as every other
// delegated permission instead of its own separate toggle. See
// supabase/migrations/0011_equipment_manager_permission.sql for the
// one-time backfill from the old column into user_permissions rows — the
// profiles.equipment_manager column itself is left in place (unused by the
// app from here on) rather than dropped, in case anything else still reads it.
//
// "משיכת מזון לנסיעות" is NOT a permission here either — it turned out not
// to need one. It's a checkbox on the event itself (events
// .food_pickup_needed) that gives the existing per-pluga "אוכל" task on the
// Klaf page a reminder; see src/lib/eventConfirmations.js's
// getFoodPickupState() and src/pages/Klaf.jsx.
//
// Where each of these actually lives in the UI:
//  - frisa_pina: src/pages/Klaf.jsx, folded into the existing frisa task.
//  - meal_regulators: src/pages/Klaf.jsx, broken down by every pluga the
//    viewer is authorized for (see effectivePermissions below for how an
//    admin ends up authorized for all of them without an explicit grant).
//  - playbox_orders: its own page, src/pages/Playbox.jsx (/playbox route).
//  - equipment_manager: src/pages/Equipment.jsx's canEdit check (gates
//    editing warehouse items and managing withdrawal requests, org-wide).

import { PLUGOT } from "./constants";

export const PERMISSIONS = {
  frisa_pina: {
    key: "frisa_pina",
    label: "פינת פריסה ומשיכה מהחד\"א",
    description: "לסמן את משימת \"משיכת פינת פריסה\" כבוצעה עבור הפלוגות שנבחרו, גם אם אינן הפלוגה של המשתמש",
    scoped: true,
  },
  playbox_orders: {
    key: "playbox_orders",
    label: "פלייבוקס והזמנות להמשך השבוע",
    description: "לראות ריכוז של כל בקשות ההזמנה מכל הפלוגות ולסמן אותן כהוזמנו",
    scoped: false,
  },
  meal_regulators: {
    key: "meal_regulators",
    label: "ניהול מווסתים לארוחות",
    description: "לערוך את רשימת המווסתים לצהריים/ערב עבור הפלוגות שנבחרו",
    scoped: true,
  },
  equipment_manager: {
    key: "equipment_manager",
    label: "אחראי משיכות ציוד",
    description: "לערוך פריטי מחסן ולנהל בקשות משיכת ציוד עבור כל הפלוגות (כמו האחראי שהוגדר בהגדרות הציוד)",
    scoped: false,
  },
  // "שוטף" (src/pages/DailySummary.jsx's שוטף tab, formerly its own
  // src/pages/Shotaf.jsx page) — assigning which pluga covers frisa/cleaning/
  // morning-assembly each day is org-wide, not per-pluga, so this is global
  // like playbox_orders/equipment_manager rather than scoped. Everyone can
  // still VIEW the tab; only a holder of this (or an admin) can change the
  // assignments.
  shotaf_schedule: {
    key: "shotaf_schedule",
    label: "עריכת שוטף",
    description: "לערוך את שיבוץ המשימות היומיות (שוטף: פינת פריסה, ניקיונות, מסדר בוקר) עבור כל הפלוגות",
    scoped: false,
  },
};

export const PERMISSION_LIST = Object.values(PERMISSIONS);

// True if `userPermissions` (an array of user_permissions rows, already
// filtered to one user_id) grants `key` — for a scoped permission, either
// for the given `pluga` specifically or globally (pluga === null, in case a
// scoped permission is ever granted org-wide). For a global-only permission,
// `pluga` can be omitted.
export function hasPermission(userPermissions, key, pluga) {
  if (!Array.isArray(userPermissions)) return false;
  return userPermissions.some((p) => {
    if (p.permission !== key) return false;
    if (p.pluga == null) return true; // global grant covers every pluga
    return pluga != null && p.pluga === pluga;
  });
}

// True if `userPermissions` holds ANY of `keys`, for any pluga (or
// globally) — coarse "can this person even reach this page" checks (nav
// visibility, route access), as opposed to hasPermission's precise
// per-pluga check used once they're actually on the page.
export function hasAnyPermission(userPermissions, keys) {
  if (!Array.isArray(userPermissions)) return false;
  return userPermissions.some((p) => keys.includes(p.permission));
}

// The distinct plugot a user holds `key` for (scoped permissions only).
// Does not special-case a global grant into "all plugot" — callers that
// need that should check hasPermission(..., null) separately.
export function plugotFor(userPermissions, key) {
  if (!Array.isArray(userPermissions)) return [];
  return userPermissions.filter((p) => p.permission === key && p.pluga != null).map((p) => p.pluga);
}

// Admins hold every delegated permission, for every pluga, automatically —
// no explicit user_permissions row needed. Every page that checks a
// signed-in user's permissions should run what it fetched through this
// first: `effectivePermissions(rawRows, role)` — then pass the result to
// hasPermission/hasAnyPermission/plugotFor exactly as before.
//
// Which role to pass depends on what the caller wants:
//  - To show what the SIGNED-IN USER actually holds (e.g. "can I see the
//    admin-only delete button"), pass their REAL role, never a previewed one
//    (see usePreviewRole) — admin-preview is for seeing the app as another
//    role, not for handing that role an admin's own permissions.
//  - To show what the ADMIN-PREVIEW PANEL's chosen role would see (e.g. "is
//    this delegated-permission-gated card visible"), pass previewRole ||
//    role — see the call sites across AppLayout/TopNav/PersonalArea/
//    Equipment/Klaf/Playbox, which all do exactly this so "תצוגת תפקיד" is a
//    true preview of a plain member of that role (no permissions beyond what
//    the admin doing the previewing personally holds — which is normally
//    none, since admins don't need grants) rather than always showing every
//    permission-gated feature because the real signed-in user is an admin.
//
// סגל holds playbox_orders by default (no explicit grant needed) — same
// "automatic, not a real row" mechanism as the admin branch below, just for
// one specific key instead of everything. An explicit per-user grant (rare —
// mainly useful for revoking would need its own UI, which doesn't exist) is
// harmless to also list here; hasPermission only checks whether a matching
// row exists at all, so a duplicate doesn't change the result.
export function effectivePermissions(userPermissions, role) {
  if (role === "admin") {
    return PERMISSION_LIST.flatMap((perm) =>
      perm.scoped ? PLUGOT.map((pluga) => ({ permission: perm.key, pluga })) : [{ permission: perm.key, pluga: null }]
    );
  }
  const base = Array.isArray(userPermissions) ? userPermissions : [];
  if (role === "סגל") {
    return [...base, { permission: "playbox_orders", pluga: null }];
  }
  return base;
}
