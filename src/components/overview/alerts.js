import {
  Siren, HardHat, CalendarClock, Package, Truck, UserPlus, Clock3, Boxes, ClipboardList, BellRing, ListChecks,
} from "lucide-react";
import { checklistProgress } from "@/lib/eventChecklist";
import { toDateStr, formatHebrewDate } from "@/lib/constants";
import { getConfirmationState } from "@/lib/eventConfirmations";
import { orderItems } from "@/lib/playbox";
import { daysFrom, shotafSlotsForDay, eventMissingRoles, dateOnly, daysOverdue } from "@/lib/battalion";

// "דורש טיפול" — every queue in the app that can be waiting on someone,
// turned into a short, ranked list of actionable rows. Each row deep-links
// to exactly where it gets handled. Role-aware: approval queues only show to
// whoever can approve them.
export const LEVEL_ORDER = { critical: 0, warning: 1, info: 2 };

// "פער קריטי אחד" vs "3 פערים קריטיים" — Hebrew needs the noun form to
// change, not just the number.
const count = (n, one, many) => (n === 1 ? one : `${n} ${many}`);

export function buildAlerts(data, { isAdmin, canApprovePlaybox, canManageEquipment }) {
  const alerts = [];
  const now = new Date();
  const todayStr = toDateStr(now);
  const week = daysFrom(now, 7);

  // Critical open gaps.
  const critical = data.gaps.filter((g) => g.priority === "קריטי" && g.status !== "טופל");
  if (critical.length) {
    alerts.push({
      id: "critical-gaps", level: "critical", icon: Siren,
      title: count(critical.length, "פער קריטי פתוח", "פערים קריטיים פתוחים"),
      detail: critical.slice(0, 2).map((g) => `${g.gap} (${g.company})`).join(" · "),
      to: critical.length === 1 ? `/?gap=${critical[0].id}` : "/",
    });
  }

  // Event confirmations past their start time and still unconfirmed.
  const escalated = data.confirmations
    .map((c) => ({ c, e: data.events.find((ev) => ev.id === c.event_id) }))
    .filter(({ c, e }) => e && getConfirmationState(e, c, now) === "escalated" && dateOnly(e.event_date) === todayStr);
  if (escalated.length) {
    alerts.push({
      id: "escalated", level: "critical", icon: BellRing,
      title: count(escalated.length, "אישור הגעה חורג מהמועד", "אישורי הגעה חורגים מהמועד"),
      detail: escalated.slice(0, 3).map(({ c, e }) => `${c.pluga} — ${e.title}`).join(" · "),
      to: `/constraints?event=${escalated[0].e.id}`,
    });
  }

  // Unassigned שוטף duties — today is critical, the rest of the week a warning.
  week.forEach(({ date, dateStr }, i) => {
    const routine = data.routines.find((r) => dateOnly(r.routine_date) === dateStr);
    const open = shotafSlotsForDay(routine, date).filter((s) => s.unassigned);
    if (!open.length) return;
    if (i === 0) {
      alerts.push({
        id: `shotaf-${dateStr}`, level: "critical", icon: ClipboardList,
        title: `היום: ${count(open.length, "משימת שוטף אחת", "משימות שוטף")} בלי פלוגה`,
        detail: open.map((s) => s.label).join(" · "),
        to: `/daily-summary?tab=shotaf&date=${dateStr}`,
      });
    }
  });
  const futureOpen = week.slice(1).reduce((sum, { date, dateStr }) => {
    const routine = data.routines.find((r) => dateOnly(r.routine_date) === dateStr);
    return sum + shotafSlotsForDay(routine, date).filter((s) => s.unassigned).length;
  }, 0);
  if (futureOpen) {
    alerts.push({
      id: "shotaf-week", level: "warning", icon: ClipboardList,
      title: `${count(futureOpen, "משימת שוטף אחת לא משובצת", "משימות שוטף לא משובצות")} השבוע`,
      detail: "המתכנן האוטומטי יכול לשבץ אותן בצורה הוגנת בלחיצה",
      to: "/daily-summary?tab=shotaf&plan=1",
    });
  }

  // Events in the next 3 days still missing a responsible pluga.
  const soonCut = toDateStr(new Date(now.getTime() + 3 * 86400000));
  const unassignedEvents = data.events
    .filter((e) => dateOnly(e.event_date) <= soonCut && eventMissingRoles(e).length)
    .sort((a, b) => dateOnly(a.event_date).localeCompare(dateOnly(b.event_date)));
  if (unassignedEvents.length === 1) {
    const e = unassignedEvents[0];
    const isToday = dateOnly(e.event_date) === todayStr;
    alerts.push({
      id: `event-${e.id}`, level: isToday ? "critical" : "warning", icon: CalendarClock,
      title: `${e.title} — חסרה פלוגה ל${eventMissingRoles(e).join(" ול")}`,
      detail: `${isToday ? "היום" : formatHebrewDate(dateOnly(e.event_date))} · ${e.start_time}`,
      to: `/constraints?event=${e.id}`,
    });
  } else if (unassignedEvents.length > 1) {
    const anyToday = unassignedEvents.some((e) => dateOnly(e.event_date) === todayStr);
    alerts.push({
      id: "events-unassigned", level: anyToday ? "critical" : "warning", icon: CalendarClock,
      title: `${unassignedEvents.length} אירועים ב-3 הימים הקרובים בלי פלוגה אחראית`,
      detail: unassignedEvents.slice(0, 3).map((e) => `${e.title} (${eventMissingRoles(e).join("/")})`).join(" · "),
      to: `/constraints?event=${unassignedEvents[0].id}`,
    });
  }

  // Events in the next 48 hours whose logistics checklist isn't done.
  const in48 = new Date(now.getTime() + 48 * 3600000);
  const openChecklists = data.events.filter((e) => {
    const { done, total } = checklistProgress(e.checklist);
    if (!total || done === total) return false;
    const start = new Date(`${dateOnly(e.event_date)}T${e.start_time || "00:00"}:00`);
    return start >= now && start <= in48;
  });
  if (openChecklists.length) {
    const first = openChecklists[0];
    const p = checklistProgress(first.checklist);
    alerts.push({
      id: "checklists", level: "warning", icon: ListChecks,
      title: openChecklists.length === 1
        ? `צ'קליסט לא הושלם: ${first.title} (${p.done}/${p.total})`
        : `${openChecklists.length} אירועים ב-48 השעות הקרובות עם צ'קליסט פתוח`,
      detail: openChecklists.slice(0, 3).map((e) => {
        const left = (e.checklist || []).filter((i) => !i.done);
        return `${e.title}: ${left.slice(0, 2).map((i) => i.text).join(", ")}${left.length > 2 ? "…" : ""}`;
      }).join(" · "),
      to: `/constraints?event=${first.id}`,
    });
  }

  // Equipment past its expected return date.
  const overdue = data.holdings.filter((h) => h.expected_return_date && daysOverdue(h.expected_return_date, now) > 0);
  if (overdue.length) {
    alerts.push({
      id: "overdue", level: "warning", icon: Clock3,
      title: `${count(overdue.length, "פריט ציוד אחד", "פריטי ציוד")} באיחור בהחזרה`,
      detail: overdue.slice(0, 2).map((h) => `${h.item_name} ×${h.quantity} — ${h.pluga} (${daysOverdue(h.expected_return_date, now)} ימים)`).join(" · "),
      to: "/equipment?tab=holdings",
    });
  }

  if (canManageEquipment && data.withdrawals.length) {
    alerts.push({
      id: "withdrawals", level: "warning", icon: Package,
      title: count(data.withdrawals.length, "בקשת משיכת ציוד ממתינה לאישור", "בקשות משיכת ציוד ממתינות לאישור"),
      detail: data.withdrawals.slice(0, 3).map((w) => `${w.pluga} · ${w.warehouse}`).join(" · "),
      to: "/equipment",
    });
  }

  if (canApprovePlaybox) {
    const waiting = data.orders.filter((o) => !o.approved && o.status === "ממתין");
    if (waiting.length) {
      alerts.push({
        id: "playbox", level: "info", icon: Truck,
        title: count(waiting.length, "הזמנת פלייבוקס ממתינה לאישורך", "הזמנות פלייבוקס ממתינות לאישורך"),
        detail: waiting.slice(0, 3).map((o) => `${o.name || "הזמנה"} (${orderItems(o).length} פריטים)`).join(" · "),
        to: `/playbox?order=${waiting[0].id}`,
      });
    }
  }

  if (isAdmin && data.accessRequests.length) {
    alerts.push({
      id: "access", level: "info", icon: UserPlus,
      title: count(data.accessRequests.length, "בקשת גישה חדשה", "בקשות גישה חדשות"),
      detail: "לאישור דרך תפריט הניהול (האייקון למעלה)",
      to: null,
    });
  }

  if (canManageEquipment) {
    const short = data.items.filter((i) => Number(i.target_quantity) > 0 && Number(i.quantity) < Number(i.target_quantity));
    if (short.length) {
      alerts.push({
        id: "shortage", level: "info", icon: Boxes,
        title: `${count(short.length, "פריט אחד", "פריטים")} במחסנים מתחת לכמות היעד`,
        detail: short.slice(0, 3).map((i) => `${i.name} (${i.quantity}/${i.target_quantity})`).join(" · "),
        to: "/equipment",
      });
    }
  }

  const stale = data.gaps.filter((g) => g.status !== "טופל" && (Date.now() - new Date(g.updated_date).getTime()) / 86400000 >= 7);
  if (stale.length) {
    alerts.push({
      id: "stale", level: "info", icon: HardHat,
      title: count(stale.length, "פער אחד לא עודכן שבוע או יותר", "פערים לא עודכנו שבוע או יותר"),
      detail: "כדאי לעבור עליהם ולעדכן סטטוס",
      to: "/",
    });
  }

  return alerts.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}
