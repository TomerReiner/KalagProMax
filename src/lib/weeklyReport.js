// Weekly battalion report — one fetch over the last 7 days, turned into
// per-pluga numbers (for the "טבלת פלוגות" leaderboard on the statistics
// page) and a multi-sheet Excel file for reporting up the chain.
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import { PLUGOT, toDateStr, formatHebrewDate } from "@/lib/constants";
import { addDays, dateOnly, plugaTasksForDay, completionKeySet, parseDateStr, shotafSlotsForDay, eventRoles, daysOverdue } from "@/lib/battalion";
import { checklistProgress } from "@/lib/eventChecklist";
import { orderItems } from "@/lib/playbox";

export async function loadWeekData(endDate = new Date()) {
  const end = toDateStr(endDate);
  const start = toDateStr(addDays(endDate, -6));
  const e = base44.entities;
  const safe = (p) => p.catch(() => []);
  const [routines, events, directTasks, completions, gaps, withdrawals, orders, holdings] = await Promise.all([
    safe(e.DailyRoutine.filter({ routine_date: { gte: start, lte: end } })),
    safe(e.Event.filter({ event_date: { gte: start, lte: end } })),
    safe(e.DirectTask.filter({ task_date: { gte: start, lte: end } })),
    safe(e.TaskCompletion.filter({ task_date: { gte: start, lte: end } })),
    safe(e.Gap.list("-created_date", 1000)),
    safe(e.WithdrawalRequest.filter({ request_date: { gte: start, lte: end } })),
    safe(e.PlayboxOrder.filter({ order_date: { gte: start, lte: end } })),
    safe(e.EquipmentHolding.list("-created_date", 500)),
  ]);
  return { start, end, routines, events, directTasks, completions, gaps, withdrawals, orders, holdings };
}

// created_date / updated_date are timestamps — compare by LOCAL calendar day.
function inRange(iso, start, end) {
  if (!iso) return false;
  const d = toDateStr(new Date(iso));
  return d >= start && d <= end;
}

// Per-pluga numbers for the week. `completionRate` is null when the viewer
// can't see other plugot's completions (task_completions RLS: own or admin).
export function plugaWeekStats(week, { withCompletion }) {
  const done = completionKeySet(week.completions);
  const days = [];
  for (let d = parseDateStr(week.start); toDateStr(d) <= week.end; d = addDays(d, 1)) days.push(d);
  return PLUGOT.map((pluga) => {
    let tasks = 0;
    let completed = 0;
    let shotaf = 0;
    days.forEach((date) => {
      const ds = toDateStr(date);
      const routine = week.routines.find((r) => dateOnly(r.routine_date) === ds);
      const list = plugaTasksForDay(pluga, date, {
        routine,
        events: week.events.filter((e) => dateOnly(e.event_date) === ds),
        directTasks: week.directTasks.filter((t) => dateOnly(t.task_date) === ds),
      });
      tasks += list.length;
      completed += list.filter((t) => done.has(t.key)).length;
      shotaf += shotafSlotsForDay(routine, date).filter((s) => s.plugot.includes(pluga)).length;
    });
    const gapsOpened = week.gaps.filter((g) => g.company === pluga && inRange(g.created_date, week.start, week.end)).length;
    const gapsClosed = week.gaps.filter((g) => g.company === pluga && g.status === "טופל" && inRange(g.updated_date, week.start, week.end)).length;
    const openGaps = week.gaps.filter((g) => g.company === pluga && g.status !== "טופל").length;
    const overdue = week.holdings.filter((h) => h.pluga === pluga && h.expected_return_date && daysOverdue(h.expected_return_date) > 0).length;
    return {
      pluga, tasks, completed, shotaf, gapsOpened, gapsClosed, openGaps, overdue,
      completionRate: withCompletion && tasks ? Math.round((completed / tasks) * 100) : null,
    };
  });
}

export function exportWeeklyReport(week, { withCompletion }) {
  const stats = plugaWeekStats(week, { withCompletion });
  const range = `${formatHebrewDate(week.start)} – ${formatHebrewDate(week.end)}`;
  const opened = week.gaps.filter((g) => inRange(g.created_date, week.start, week.end));
  const closed = week.gaps.filter((g) => g.status === "טופל" && inRange(g.updated_date, week.start, week.end));

  const summary = [
    { "נושא": "טווח הדוח", "ערך": range },
    { "נושא": "פערים שנפתחו", "ערך": opened.length },
    { "נושא": "פערים שטופלו", "ערך": closed.length },
    { "נושא": "פערים פתוחים כרגע", "ערך": week.gaps.filter((g) => g.status !== "טופל").length },
    { "נושא": "פערים קריטיים פתוחים", "ערך": week.gaps.filter((g) => g.status !== "טופל" && g.priority === "קריטי").length },
    { "נושא": "משימות שוטף ששובצו", "ערך": stats.reduce((s, x) => s + x.shotaf, 0) },
    { "נושא": "אירועים", "ערך": week.events.length },
    { "נושא": "בקשות משיכת ציוד", "ערך": week.withdrawals.length },
    { "נושא": "הזמנות פלייבוקס", "ערך": week.orders.length },
    { "נושא": "ציוד באיחור בהחזרה", "ערך": week.holdings.filter((h) => h.expected_return_date && daysOverdue(h.expected_return_date) > 0).length },
  ];

  const plugot = stats.map((s) => ({
    "פלוגה": s.pluga,
    "משימות": s.tasks,
    ...(withCompletion ? { "בוצעו": s.completed, "אחוז ביצוע": s.completionRate == null ? "" : `${s.completionRate}%` } : {}),
    "תורנויות שוטף": s.shotaf,
    "פערים שנפתחו": s.gapsOpened,
    "פערים שטופלו": s.gapsClosed,
    "פערים פתוחים": s.openGaps,
    "ציוד באיחור": s.overdue,
  }));

  const gapsSheet = [...opened, ...closed.filter((g) => !opened.includes(g))].map((g) => ({
    "פלוגה": g.company || "",
    "תיאור": g.gap || "",
    "מיקום": g.location || "",
    "עדיפות": g.priority || "",
    "סטטוס": g.status || "",
    "נפתח": g.created_date ? new Date(g.created_date).toLocaleDateString("he-IL") : "",
    "עודכן": g.updated_date ? new Date(g.updated_date).toLocaleDateString("he-IL") : "",
  }));

  const eventsSheet = [...week.events]
    .sort((a, b) => `${dateOnly(a.event_date)}${a.start_time}`.localeCompare(`${dateOnly(b.event_date)}${b.start_time}`))
    .map((e) => {
      const p = checklistProgress(e.checklist);
      return {
        "תאריך": dateOnly(e.event_date),
        "שעה": `${e.start_time}–${e.end_time}`,
        "אירוע": e.title,
        "סוג": e.event_type,
        "אחריות": eventRoles(e).map((r) => `${r.role}: ${r.pluga || "טרם נקבע"}`).join(" · "),
        "צ'קליסט": p.total ? `${p.done}/${p.total}` : "",
      };
    });

  const ordersSheet = week.orders.map((o) => ({
    "שם": o.name || "",
    "תאריך": o.order_date || "",
    "סטטוס": o.status || "",
    "אושר": o.approved ? "כן" : "לא",
    "פריטים": orderItems(o).map((i) => `${i.name} ×${i.quantity}`).join(", "),
  }));

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const add = (rows, name, cols) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "": "אין נתונים" }]);
    if (cols) ws["!cols"] = cols.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add(summary, "סיכום", [26, 40]);
  add(plugot, "פלוגות", [10, 10, 10, 12, 14, 14, 14, 14, 12]);
  add(gapsSheet, "פערים", [10, 40, 18, 10, 10, 12, 12]);
  add(eventsSheet, "אירועים", [12, 14, 32, 10, 40, 10]);
  add(ordersSheet, "פלייבוקס", [20, 12, 10, 8, 50]);
  XLSX.writeFile(wb, `דוח_שבועי_${week.start}_עד_${week.end}.xlsx`);
}
