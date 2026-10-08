// Battalion-level derived data — pure functions (no fetching) shared by the
// "תמונת מצב" page (src/pages/Overview.jsx), its per-pluga drill-down, the
// daily brief and the שוטף planner. Everything here works on the same rows
// the rest of the app already loads (daily_routines, events, direct_tasks,
// recurring events, ...), so these views can never disagree with the pages
// they summarize.
import { PLUGOT, SHOTAF_FIELD_LABELS, getShotafTime, toDateStr, formatHebrewDate } from "@/lib/constants";

export const SHOTAF_FIELDS = ["morning_assembly_plugas", "frisa_morning", "noon_cleaning", "evening_cleaning"];
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function parseDateStr(str) {
  if (!str || !/^\d{4}-\d{2}-\d{2}/.test(str)) return null;
  const [y, m, d] = str.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

export function daysFrom(date, count) {
  return Array.from({ length: count }, (_, i) => {
    const d = addDays(date, i);
    return { date: d, dateStr: toDateStr(d) };
  });
}

export function isUnassigned(value) {
  return !value || value === "טרם הוחלט" || (Array.isArray(value) && value.length === 0);
}

export function assignedPlugot(value) {
  if (isUnassigned(value)) return [];
  return Array.isArray(value) ? value : [value];
}

// The שוטף duties that actually run on `date` (none on Friday/Saturday —
// see SHOTAF_TIMES in constants.js), with who's assigned.
export function shotafSlotsForDay(routine, date) {
  return SHOTAF_FIELDS.map((field) => {
    const time = getShotafTime(field, date);
    if (!time) return null;
    const value = routine?.[field];
    return { field, label: SHOTAF_FIELD_LABELS[field], time, value, plugot: assignedPlugot(value), unassigned: isUnassigned(value) };
  }).filter(Boolean);
}

// Which plugot an event involves, and in what role.
export function eventRoles(event) {
  if (event.event_type === "חיצוני") {
    return [
      { role: "הסעים", pluga: isUnassigned(event.transport_pluga) ? null : event.transport_pluga, field: "transport" },
      { role: "אוכל", pluga: isUnassigned(event.food_pluga) ? null : event.food_pluga, field: "food" },
    ];
  }
  const plugot = event.responsible_plugas || [];
  if (plugot.length === 0) return [{ role: "אחראית", pluga: null, field: "responsible" }];
  return plugot.map((p) => ({ role: "אחראית", pluga: p, field: "responsible" }));
}

export function eventMissingRoles(event) {
  return eventRoles(event).filter((r) => !r.pluga).map((r) => r.role);
}

// Mirrors Constraints.jsx's getRecurringForDate: recurring events that fall
// on `date`, minus the ones moved away from it, plus the ones moved onto it.
export function recurringForDate(date, recurringEvents = [], overrides = []) {
  const dStr = toDateStr(date);
  const dayKey = DAY_KEYS[date.getDay()];
  const result = [];
  recurringEvents.forEach((re) => {
    if (re.recurrence !== "daily" && re.recurrence !== dayKey) return;
    if (overrides.some((o) => o.recurring_event_id === re.id && o.original_date === dStr)) return;
    result.push(re);
  });
  overrides.forEach((o) => {
    if (o.new_date !== dStr) return;
    const re = recurringEvents.find((r) => r.id === o.recurring_event_id);
    if (re) result.push(re);
  });
  return result;
}

// A pluga's own task list for one day — the same set Klaf.jsx /
// useOpenTasksToday build for a קלפ (assigned duties only). Each task's `key`
// matches task_completions' `${task_id}_${task_field}`.
export function plugaTasksForDay(pluga, date, { routine, events = [], directTasks = [] }) {
  const tasks = [];
  shotafSlotsForDay(routine, date).forEach((slot) => {
    if (slot.plugot.includes(pluga)) {
      tasks.push({ key: `${routine.id}_${slot.field}`, label: slot.label, time: slot.time.start, kind: "shotaf" });
    }
  });
  events.forEach((e) => {
    eventRoles(e).forEach((r) => {
      if (r.pluga === pluga) {
        const label = e.event_type === "חיצוני" ? `${e.title} - ${r.role}` : e.title;
        tasks.push({ key: `${e.id}_${r.field}`, label, time: e.start_time, kind: "event", eventId: e.id });
      }
    });
  });
  directTasks.forEach((dt) => {
    const plugot = dt.responsible_plugas?.length ? dt.responsible_plugas : dt.pluga ? [dt.pluga] : [];
    if (plugot.includes(pluga)) tasks.push({ key: `${dt.id}_${dt.id}`, label: dt.title, time: dt.start_time || null, kind: "direct" });
  });
  return tasks.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
}

export function completionKeySet(completions = []) {
  return new Set(completions.map((c) => `${c.task_id}_${c.task_field}`));
}

// Constraint rows have two historical shapes — a single `pluga` or a
// `plugas` array (see the note in README-SUPABASE.md).
export function constraintPlugot(c) {
  if (c.plugas?.length) return c.plugas;
  return c.pluga ? [c.pluga] : [];
}

export function daysOverdue(expectedReturnDate, today = new Date()) {
  const d = parseDateStr(expectedReturnDate);
  if (!d) return 0;
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  return Math.floor((t - d) / 86400000);
}

// ---------------------------------------------------------------------------
// Daily brief — a WhatsApp-ready summary of one day.
// ---------------------------------------------------------------------------
export const BRIEF_SECTIONS = [
  { key: "shotaf", label: "שוטף" },
  { key: "events", label: "אירועים" },
  { key: "tasks", label: "משימות לפלוגות" },
  { key: "regulators", label: "מווסתים" },
  { key: "constraints", label: "אילוצים" },
  { key: "announcements", label: "הודעות" },
];

export function buildDailyBrief({ date, routine, events = [], recurring = [], directTasks = [], regulators = [], constraints = [], announcements = [], sections }) {
  const on = (k) => !sections || sections.includes(k);
  const lines = [`*בריף יומי — ${formatHebrewDate(date)}*`];

  if (on("shotaf")) {
    const slots = shotafSlotsForDay(routine, date).sort((a, b) => a.time.start.localeCompare(b.time.start));
    if (slots.length) {
      lines.push("", "🧹 *שוטף*");
      slots.forEach((s) => lines.push(`• ${s.label} (${s.time.start}–${s.time.end}): ${s.plugot.length ? s.plugot.join(", ") : "טרם נקבע"}`));
    }
  }

  if (on("events")) {
    const all = [
      ...events.map((e) => ({ time: e.start_time, end: e.end_time, title: e.title, roles: eventRoles(e) })),
      ...recurring.map((r) => ({ time: r.start_time, end: r.end_time, title: r.title, roles: r.pluga ? [{ role: "פלוגה", pluga: r.pluga }] : [] })),
    ].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    if (all.length) {
      lines.push("", "📅 *אירועים*");
      all.forEach((e) => {
        // Group same-role plugot: "אחראיות: בשור, צין" rather than repeating the role.
        const byRole = {};
        e.roles.forEach((r) => {
          (byRole[r.role] = byRole[r.role] || []).push(r.pluga || "טרם נקבע");
        });
        const who = Object.entries(byRole)
          .map(([role, plugot]) => `${role === "אחראית" && plugot.length > 1 ? "אחראיות" : role}: ${plugot.join(", ")}`)
          .join(" · ");
        lines.push(`• ${e.time}–${e.end} ${e.title}${who ? ` (${who})` : ""}`);
      });
    }
  }

  if (on("tasks")) {
    const dated = directTasks.filter((t) => t.status !== "טופלה");
    if (dated.length) {
      lines.push("", "✅ *משימות לפלוגות*");
      dated.forEach((t) => {
        const plugot = t.responsible_plugas?.length ? t.responsible_plugas : t.pluga ? [t.pluga] : [];
        lines.push(`• ${t.title}${plugot.length ? ` — ${plugot.join(", ")}` : ""}${t.start_time ? ` (${t.start_time})` : ""}`);
      });
    }
  }

  if (on("regulators")) {
    const filled = PLUGOT.map((p) => {
      const parts = ["צהריים", "ערב"].map((meal) => {
        const row = regulators.find((r) => r.pluga === p && r.meal_type === meal);
        if (!row || (!(row.regulators || []).length && !row.entry_time)) return null;
        const names = (row.regulators || []).map((r) => r.name).join(", ");
        return `${meal}${row.entry_time ? ` ${row.entry_time}` : ""}${names ? `: ${names}` : ""}`;
      }).filter(Boolean);
      return parts.length ? `• ${p} — ${parts.join(" | ")}` : null;
    }).filter(Boolean);
    if (filled.length) lines.push("", "🍽️ *מווסתים*", ...filled);
  }

  if (on("constraints") && constraints.length) {
    lines.push("", "⛔ *אילוצים*");
    [...constraints]
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
      .forEach((c) => lines.push(`• ${c.start_time}–${c.end_time} ${c.title} (${constraintPlugot(c).join(", ")})`));
  }

  if (on("announcements") && announcements.length) {
    lines.push("", "📢 *הודעות*");
    announcements.forEach((a) => lines.push(`• ${a.title}${a.body ? ` — ${a.body}` : ""}`));
  }

  if (lines.length === 1) lines.push("", "אין פעילות מתוכננת ליום הזה.");
  return lines.join("\n");
}
