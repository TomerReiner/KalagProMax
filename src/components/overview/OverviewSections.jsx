import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, PartyPopper, Clock } from "lucide-react";
import { PLUGOT, PLUGA_COLORS, toDateStr } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { checklistProgress } from "@/lib/eventChecklist";
import {
  shotafSlotsForDay, eventRoles, recurringForDate, plugaTasksForDay, completionKeySet, constraintPlugot,
  dateOnly, daysFrom, daysOverdue,
} from "@/lib/battalion";

const LEVEL_STYLE = {
  critical: { row: "border-red-200 bg-red-50", icon: "bg-red-100 text-red-700", dot: "bg-red-500" },
  warning: { row: "border-amber-200 bg-amber-50", icon: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  info: { row: "border-slate-200 bg-white", icon: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

export function SectionTitle({ children, aside }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <h2 className="text-sm font-semibold text-slate-700">{children}</h2>
      {aside}
    </div>
  );
}

export function PlugaChip({ pluga, className }) {
  if (!pluga) return <span className={cn("text-[11px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium", className)}>טרם נקבע</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full font-medium", PLUGA_COLORS[pluga]?.light, className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", PLUGA_COLORS[pluga]?.dot)} />
      {pluga}
    </span>
  );
}

// ---------------------------------------------------------------------------
// דורש טיפול
// ---------------------------------------------------------------------------
export function AlertsPanel({ alerts }) {
  const [expanded, setExpanded] = useState(false);
  if (!alerts.length) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
        <PartyPopper className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-900">הכל תקין — אין שום דבר שמחכה לטיפול</p>
          <p className="text-xs text-emerald-700">אין פערים קריטיים, שוטף משובץ, ואין בקשות ממתינות.</p>
        </div>
      </div>
    );
  }
  // Critical rows always show; beyond that the list stays short (5 rows) so
  // the rest of the page isn't pushed off-screen.
  const limit = Math.max(5, alerts.filter((a) => a.level === "critical").length);
  const visible = expanded ? alerts : alerts.slice(0, limit);
  return (
    <div className="space-y-2">
      {visible.map((a) => {
        const style = LEVEL_STYLE[a.level];
        const Icon = a.icon;
        const body = (
          <>
            <span className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", style.icon)}>
              <Icon className="w-4 h-4" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-slate-900 truncate">{a.title}</span>
              {a.detail && <span className="block text-xs text-muted-foreground truncate">{a.detail}</span>}
            </span>
            {a.to && <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />}
          </>
        );
        const cls = cn("flex items-center gap-3 rounded-xl border p-2.5 transition-colors", style.row, a.to && "hover:brightness-[0.98]");
        return a.to ? (
          <Link key={a.id} to={a.to} className={cls}>{body}</Link>
        ) : (
          <div key={a.id} className={cls}>{body}</div>
        );
      })}
      {alerts.length > limit && (
        <button onClick={() => setExpanded((x) => !x)} className="w-full text-xs text-muted-foreground hover:text-foreground py-1">
          {expanded ? "הצג פחות" : `עוד ${alerts.length - limit} פריטים לטיפול`}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// היום — one chronological agenda over every content world
// ---------------------------------------------------------------------------
export function buildAgenda(data, date) {
  const ds = toDateStr(date);
  const routine = data.routines.find((r) => dateOnly(r.routine_date) === ds);
  const items = [];
  shotafSlotsForDay(routine, date).forEach((s) => {
    items.push({ key: `s-${s.field}`, time: s.time.start, end: s.time.end, title: s.label, tag: "שוטף", plugot: s.plugot, missing: s.unassigned, to: `/daily-summary?tab=shotaf&date=${ds}` });
  });
  data.events.filter((e) => dateOnly(e.event_date) === ds).forEach((e) => {
    const roles = eventRoles(e);
    items.push({ key: `e-${e.id}`, time: e.start_time, end: e.end_time, title: e.title, tag: e.event_type === "חיצוני" ? "אירוע חיצוני" : "אירוע", roles, missing: roles.some((r) => !r.pluga), checklist: checklistProgress(e.checklist), to: `/constraints?event=${e.id}` });
  });
  recurringForDate(date, data.recurring, data.overrides).forEach((r) => {
    items.push({ key: `r-${r.id}`, time: r.start_time, end: r.end_time, title: r.title, tag: "קבוע", plugot: r.pluga ? [r.pluga] : [], to: `/constraints?date=${ds}` });
  });
  data.directTasks.filter((t) => dateOnly(t.task_date) === ds && t.start_time).forEach((t) => {
    const plugot = t.responsible_plugas?.length ? t.responsible_plugas : t.pluga ? [t.pluga] : [];
    items.push({ key: `t-${t.id}`, time: t.start_time, end: t.end_time, title: t.title, tag: "משימה", plugot });
  });
  data.regulators.filter((r) => dateOnly(r.meal_date) === ds && r.entry_time).forEach((r) => {
    items.push({ key: `m-${r.id}`, time: r.entry_time, title: `כניסה ל${r.meal_type === "ערב" ? "ארוחת ערב" : "ארוחת צהריים"}`, tag: "מווסתים", plugot: [r.pluga], to: `/meal-regulators?date=${ds}` });
  });
  data.constraints.filter((c) => dateOnly(c.constraint_date) === ds).forEach((c) => {
    items.push({ key: `c-${c.id}`, time: c.start_time, end: c.end_time, title: c.title, tag: "אילוץ", plugot: constraintPlugot(c), muted: true, to: `/constraints?date=${ds}` });
  });
  return items.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function TodayAgenda({ data, date, isToday }) {
  const items = buildAgenda(data, date);
  const now = nowHHMM();
  const untimed = data.directTasks.filter((t) => dateOnly(t.task_date) === toDateStr(date) && !t.start_time && t.status !== "טופלה");
  if (!items.length && !untimed.length) {
    return <p className="text-sm text-muted-foreground bg-white border rounded-xl p-4 text-center">אין פעילות מתוכננת</p>;
  }
  return (
    <div className="bg-white border rounded-xl divide-y">
      {items.map((it) => {
        const crossesMidnight = it.end && it.end < it.time;
        const isNow = isToday && it.time && it.time <= now && (!it.end || crossesMidnight || now < it.end);
        const isPast = isToday && !isNow && (it.end ? !crossesMidnight && it.end <= now : it.time < now);
        const content = (
          <div className={cn("flex items-start gap-3 px-3 py-2.5", isPast && "opacity-50", it.muted && "bg-slate-50/60")}>
            <div className="w-12 shrink-0 text-xs tabular-nums text-slate-500 pt-0.5" dir="ltr">{it.time}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={cn("text-sm font-medium", it.missing && "text-red-700")}>{it.title}</span>
                {isNow && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-600 text-white font-semibold">עכשיו</span>}
                {it.checklist?.total > 0 && (
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full tabular-nums", it.checklist.done === it.checklist.total ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800")}>
                    צ'קליסט {it.checklist.done}/{it.checklist.total}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-wrap mt-1">
                <span className="text-[10px] text-muted-foreground ml-1">{it.tag}</span>
                {it.roles
                  ? it.roles.map((r, i) => (
                      <span key={i} className="inline-flex items-center gap-1">
                        {it.roles.length > 1 || r.role !== "אחראית" ? <span className="text-[10px] text-muted-foreground">{r.role}:</span> : null}
                        <PlugaChip pluga={r.pluga} />
                      </span>
                    ))
                  : it.plugot?.length
                    ? it.plugot.map((p) => <PlugaChip key={p} pluga={p} />)
                    : it.tag === "שוטף" ? <PlugaChip pluga={null} /> : null}
              </div>
            </div>
          </div>
        );
        return it.to ? (
          <Link key={it.key} to={it.to} className="block hover:bg-slate-50 transition-colors">{content}</Link>
        ) : (
          <div key={it.key}>{content}</div>
        );
      })}
      {untimed.length > 0 && (
        <div className="px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground mb-1">משימות ללא שעה</p>
          <div className="flex flex-wrap gap-1.5">
            {untimed.map((t) => {
              const plugot = t.responsible_plugas?.length ? t.responsible_plugas : t.pluga ? [t.pluga] : [];
              return (
                <span key={t.id} className="text-xs bg-slate-100 rounded-full px-2 py-0.5">
                  {t.title}{plugot.length ? ` · ${plugot.join(", ")}` : ""}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// פלוגות — one card per pluga, click to drill down
// ---------------------------------------------------------------------------
export function plugaSnapshot(data, pluga, date, showCompletion) {
  const ds = toDateStr(date);
  const routine = data.routines.find((r) => dateOnly(r.routine_date) === ds);
  const tasks = plugaTasksForDay(pluga, date, {
    routine,
    events: data.events.filter((e) => dateOnly(e.event_date) === ds),
    directTasks: data.directTasks.filter((t) => dateOnly(t.task_date) === ds),
  });
  const done = completionKeySet(data.completions);
  const openGaps = data.gaps.filter((g) => g.company === pluga && g.status !== "טופל");
  const holdings = data.holdings.filter((h) => h.pluga === pluga);
  const overdue = holdings.filter((h) => h.expected_return_date && daysOverdue(h.expected_return_date) > 0);
  const constraintsToday = data.constraints.filter((c) => dateOnly(c.constraint_date) === ds && constraintPlugot(c).includes(pluga));
  const regulatorsFilled = data.regulators.some((r) => r.pluga === pluga && dateOnly(r.meal_date) === ds && ((r.regulators || []).length || r.entry_time));
  const klafs = data.profiles.filter((p) => p.role === "קלפ" && p.pluga === pluga);
  return {
    tasks,
    doneCount: showCompletion ? tasks.filter((t) => done.has(t.key)).length : null,
    openGaps, holdings, overdue, constraintsToday, regulatorsFilled, klafs,
  };
}

export function PlugaGrid({ data, date, showCompletion, onSelect }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      {PLUGOT.map((p) => {
        const s = plugaSnapshot(data, p, date, showCompletion);
        const color = PLUGA_COLORS[p];
        const pct = s.tasks.length && s.doneCount != null ? Math.round((s.doneCount / s.tasks.length) * 100) : null;
        return (
          <button
            key={p}
            onClick={() => onSelect(p)}
            className="text-right bg-white border rounded-xl overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className={cn("h-1.5", color.bg)} />
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold">{p}</span>
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{s.klafs.map((k) => k.full_name || k.email).join(", ") || "אין קל\"פ רשום"}</p>
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">משימות היום</span>
                  <span className="font-semibold tabular-nums">{s.doneCount != null ? `${s.doneCount}/${s.tasks.length}` : s.tasks.length}</span>
                </div>
                {pct != null && (
                  <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                    <div className={cn("h-full rounded-full", pct === 100 ? "bg-emerald-500" : color.bg)} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1 min-h-[20px]">
                {s.openGaps.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800" title="פערים פתוחים">
                    {s.openGaps.length} פערים
                  </span>
                )}
                {s.holdings.length > 0 && (
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", s.overdue.length ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600")} title="ציוד בידי הפלוגה">
                    ציוד {s.holdings.length}{s.overdue.length ? ` · ${s.overdue.length} באיחור` : ""}
                  </span>
                )}
                {s.constraintsToday.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600" title="אילוצים היום">
                    {s.constraintsToday.length === 1 ? "אילוץ היום" : `${s.constraintsToday.length} אילוצים`}
                  </span>
                )}
                {s.regulatorsFilled && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700" title="מווסתים מולאו להיום">
                    מווסתים ✓
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// השבוע — 7-day strip: שוטף coverage, events, constraints
// ---------------------------------------------------------------------------
const DAY_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export function WeekStrip({ data }) {
  const days = daysFrom(new Date(), 7);
  return (
    <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-4 xl:grid-cols-4 gap-1.5">
      {days.map(({ date, dateStr }, i) => {
        const routine = data.routines.find((r) => dateOnly(r.routine_date) === dateStr);
        const slots = shotafSlotsForDay(routine, date);
        const assigned = slots.filter((s) => !s.unassigned).length;
        const events = data.events.filter((e) => dateOnly(e.event_date) === dateStr).length + recurringForDate(date, data.recurring, data.overrides).length;
        const constraints = data.constraints.filter((c) => dateOnly(c.constraint_date) === dateStr).length;
        const full = slots.length === 0 || assigned === slots.length;
        return (
          <Link
            key={dateStr}
            to={`/constraints?date=${dateStr}`}
            className={cn("rounded-xl border bg-white p-2 text-center hover:shadow-sm transition-shadow", i === 0 && "ring-2 ring-slate-900")}
          >
            <p className="text-[11px] text-muted-foreground">{i === 0 ? "היום" : DAY_SHORT[date.getDay()]}</p>
            <p className="text-sm font-bold tabular-nums">{date.getDate()}.{date.getMonth() + 1}</p>
            {slots.length > 0 ? (
              <div className="mt-1.5 flex justify-center gap-0.5" title={`שוטף: ${assigned}/${slots.length} משובצים`}>
                {slots.map((s) => (
                  <span key={s.field} className={cn("w-2 h-2 rounded-full", s.unassigned ? "bg-red-400" : "bg-emerald-500")} />
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[10px] text-muted-foreground">סופ״ש</p>
            )}
            <p className={cn("mt-1 text-[10px]", events ? "text-slate-700" : "text-muted-foreground")}>{events} אירועים</p>
            {constraints > 0 && <p className="text-[10px] text-muted-foreground">{constraints} אילוצים</p>}
            {!full && <p className="text-[10px] text-red-600 font-medium">חסר שיבוץ</p>}
          </Link>
        );
      })}
    </div>
  );
}

export function LastUpdated({ at }) {
  if (!at) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <Clock className="w-3 h-3" />
      מתעדכן חי · {at.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}
