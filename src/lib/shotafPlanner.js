// שוטף planner — conflict detection and a fair weekly auto-assignment.
//
// Conflicts: a pluga is "busy" for a duty if, on that day, it has a
// constraint (אילוץ) or is responsible for an event (internal responsibility,
// transport or food) whose time overlaps the duty's time window.
//
// Fairness: each duty goes to the pluga with the lowest load score — its
// total duties plus how many times it did THIS duty — over the look-back
// window (30 days), the assignments already fixed in the planned week, and
// whatever the plan itself has handed out so far. A pluga with no other duty
// that day is preferred. Ties rotate by day so the same pluga doesn't always
// win them. Busy plugot are only used if every pluga is busy
// (and the proposal is then flagged as a conflict).
import { PLUGOT, toDateStr } from "@/lib/constants";
import { SHOTAF_FIELDS, shotafSlotsForDay, isUnassigned, assignedPlugot, constraintPlugot, eventRoles, dateOnly, addDays } from "@/lib/battalion";

export function toMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
}

function interval(start, end) {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (s == null) return null;
  if (e == null || e <= s) e = 24 * 60; // open-ended or crossing midnight → rest of the day
  return [s, e];
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  const a = interval(aStart, aEnd);
  const b = interval(bStart, bEnd);
  if (!a || !b) return false;
  return a[0] < b[1] && b[0] < a[1];
}

// Everything that makes `pluga` busy during [start, end) on `dateStr`.
export function plugaConflicts(pluga, dateStr, start, end, { constraints = [], events = [] }) {
  const out = [];
  constraints.forEach((c) => {
    if (dateOnly(c.constraint_date) !== dateStr || !constraintPlugot(c).includes(pluga)) return;
    if (overlaps(start, end, c.start_time, c.end_time)) out.push({ kind: "אילוץ", title: c.title, start: c.start_time, end: c.end_time });
  });
  events.forEach((e) => {
    if (dateOnly(e.event_date) !== dateStr) return;
    if (!eventRoles(e).some((r) => r.pluga === pluga)) return;
    if (overlaps(start, end, e.start_time, e.end_time)) out.push({ kind: "אירוע", title: e.title, start: e.start_time, end: e.end_time });
  });
  return out;
}

export function emptyCounts() {
  return Object.fromEntries(PLUGOT.map((p) => [p, { total: 0, ...Object.fromEntries(SHOTAF_FIELDS.map((f) => [f, 0])) }]));
}

export function countDuties(routines) {
  const counts = emptyCounts();
  routines.forEach((r) => {
    SHOTAF_FIELDS.forEach((f) => {
      assignedPlugot(r[f]).forEach((p) => {
        if (!counts[p]) return;
        counts[p][f] += 1;
        counts[p].total += 1;
      });
    });
  });
  return counts;
}

// Sunday of the week containing `date`; on Friday/Saturday, next week's
// Sunday (that's the week anyone planning on a weekend means). Past days of
// the current week are skipped by planWeek itself.
export function planningWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  if (day >= 5) return addDays(d, 7 - day);
  return addDays(d, -day);
}

// The most common number of plugot at מסדר בוקר in recent history (1 if none).
export function typicalAssemblySize(routines) {
  const freq = {};
  routines.forEach((r) => {
    const n = assignedPlugot(r.morning_assembly_plugas).length;
    if (n > 0) freq[n] = (freq[n] || 0) + 1;
  });
  const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  return best ? Number(best[0]) : 1;
}

/**
 * @returns {Array<{ dateStr, date, routine, cells: Array<{ field, label, time, existing, proposed: string[], changed, conflicts }> }>}
 */
export function planWeek({ weekStart, routines, history, constraints, events, overwrite = false, assemblySize = 1 }) {
  const todayStr = toDateStr(new Date());
  // Load = history + assignments in the planned week that we're keeping.
  const counts = countDuties([
    ...history,
    ...(overwrite ? routines.filter((r) => dateOnly(r.routine_date) < todayStr) : routines),
  ]);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const dateStr = toDateStr(date);
    // Never (re)plan days that already happened.
    if (dateStr < todayStr) continue;
    const routine = routines.find((r) => dateOnly(r.routine_date) === dateStr) || null;
    const slots = shotafSlotsForDay(routine, date).sort((a, b) => a.time.start.localeCompare(b.time.start));
    if (!slots.length) continue;

    const dayTaken = new Set();
    // Duties we keep count toward "already busy today" first.
    slots.forEach((s) => {
      if (!overwrite && !s.unassigned) s.plugot.forEach((p) => dayTaken.add(p));
    });

    const cells = slots.map((s) => {
      const keep = !overwrite && !s.unassigned;
      if (keep) {
        return { field: s.field, label: s.label, time: s.time, existing: s.plugot, proposed: s.plugot, changed: false, conflicts: [] };
      }
      const need = s.field === "morning_assembly_plugas" ? Math.max(1, assemblySize) : 1;
      const ranked = PLUGOT.map((p, idx) => {
        const conflicts = plugaConflicts(p, dateStr, s.time.start, s.time.end, { constraints, events });
        return {
          p,
          conflicts,
          busy: conflicts.length > 0,
          sameDay: dayTaken.has(p),
          fieldCount: counts[p][s.field],
          total: counts[p].total,
          rot: (idx + i) % PLUGOT.length,
        };
      }).sort((a, b) =>
        a.busy - b.busy || a.sameDay - b.sameDay || (a.total + a.fieldCount) - (b.total + b.fieldCount) || a.fieldCount - b.fieldCount || a.rot - b.rot
      );
      const picked = ranked.slice(0, need);
      picked.forEach(({ p }) => {
        counts[p][s.field] += 1;
        counts[p].total += 1;
        dayTaken.add(p);
      });
      return {
        field: s.field,
        label: s.label,
        time: s.time,
        existing: s.plugot,
        proposed: picked.map((x) => x.p),
        changed: true,
        conflicts: picked.flatMap((x) => x.conflicts.map((c) => ({ ...c, pluga: x.p }))),
      };
    });
    days.push({ date, dateStr, routine, cells });
  }
  return { days, counts };
}

// Turns a (possibly hand-edited) plan into the per-day write payloads.
export function planToWrites(days) {
  return days
    .map((d) => {
      const changes = {};
      d.cells.forEach((c) => {
        if (!c.changed) return;
        changes[c.field] = c.field === "morning_assembly_plugas" ? c.proposed : c.proposed[0] || "טרם הוחלט";
      });
      return Object.keys(changes).length ? { dateStr: d.dateStr, routine: d.routine, changes } : null;
    })
    .filter(Boolean);
}

export function isFieldUnassigned(routine, field) {
  return isUnassigned(routine?.[field]);
}
