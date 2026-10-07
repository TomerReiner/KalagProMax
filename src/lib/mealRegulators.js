// Meal regulators ("מווסתים") — who may do what, and the "please fill in"
// task the manager hands to a pluga's קלפ. Used by src/pages/MealRegulators.jsx
// (the full page) and src/pages/Klaf.jsx (the task row + day summary).
//
// Roles:
//  - Manager: holds meal_regulators_manager (admin automatically, see
//    effectivePermissions in src/lib/permissions.js). Edits every pluga and
//    assigns tasks.
//  - Scoped editor: holds meal_regulators for specific plugot — can always
//    edit those plugot.
//  - Assigned קלפ: a קלפ whose pluga got a fill-in task for that day can
//    edit their own pluga for that day.
//  - Everyone else: read-only view of whatever has been filled in that day.
//
// The assignment is an ordinary direct_tasks row tagged kind =
// 'meal_regulators' (supabase/migrations/0020_meal_regulator_tasks.sql), so
// it shows up as a task in the קלפ's "המשימות שלי", the admin "משימות" page
// and the 07:00 push without any extra plumbing.
import { hasPermission } from "@/lib/permissions";

export const MEAL_TYPES = ["צהריים", "ערב"];
export const MEAL_TASK_KIND = "meal_regulators";
export const MEAL_TASK_TITLE = "מילוי מווסתים לארוחות";

export function isMealRegulatorsManager(delegatedPermissions) {
  return hasPermission(delegatedPermissions, "meal_regulators_manager");
}

// `assignedTasks` = that day's kind = 'meal_regulators' direct_tasks rows.
export function canEditPlugaRegulators({ delegatedPermissions, effectiveRole, userPluga, pluga, assignedTasks }) {
  if (isMealRegulatorsManager(delegatedPermissions)) return true;
  if (hasPermission(delegatedPermissions, "meal_regulators", pluga)) return true;
  return (
    effectiveRole === "קלפ" &&
    userPluga === pluga &&
    (assignedTasks || []).some((t) => taskPlugot(t).includes(pluga))
  );
}

export function taskPlugot(task) {
  if (task?.responsible_plugas?.length) return task.responsible_plugas;
  return task?.pluga ? [task.pluga] : [];
}

// A meal_regulators row "counts" as filled once it has a regulator or an
// entry time — used to decide which plugot appear in the read-only summary
// and whether an assigned pluga already did its part.
export function isRowFilled(row) {
  return (row?.regulators?.length || 0) > 0 || !!row?.entry_time;
}
