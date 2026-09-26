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
// Equipment withdrawal ("משיכת ציוד") is intentionally NOT one of the keys
// here: it already has its own personal-flag column, profiles
// .equipment_manager, which predates this table and already does exactly
// what this table does (a personal flag, independent of role). It's kept as
// its own column rather than folded in here to avoid touching working code;
// the AdminPanel UI just displays it in the same section as these.
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
// first: `effectivePermissions(rawRows, user.role)` — then pass the result
// to hasPermission/hasAnyPermission/plugotFor exactly as before. Pass the
// user's REAL role here, never a previewed one (see usePreviewRole) — the
// admin-preview switcher is for seeing the app as another role, not for
// handing that role an admin's permissions.
export function effectivePermissions(userPermissions, role) {
  if (role !== "admin") return Array.isArray(userPermissions) ? userPermissions : [];
  return PERMISSION_LIST.flatMap((perm) =>
    perm.scoped ? PLUGOT.map((pluga) => ({ permission: perm.key, pluga })) : [{ permission: perm.key, pluga: null }]
  );
}
