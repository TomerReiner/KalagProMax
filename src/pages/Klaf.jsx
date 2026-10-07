import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight, ChevronLeft, CheckCircle2, Circle, ExternalLink, Sun, Sunset, Moon, Users, Truck, UtensilsCrossed, Plus, ClipboardList, BellRing } from "lucide-react";
import { PLUGA_COLORS, PLUGOT, formatHebrewDate, toDateStr } from "@/lib/constants";
import { cn } from "@/lib/utils";
import DirectTaskForm from "@/components/klaf/DirectTaskForm";
import KlafSchedule from "@/components/klaf/KlafSchedule";
import KlafConstraints from "@/components/klaf/KlafConstraints";
import KlafSummary from "@/components/klaf/KlafSummary";
import KlafEventConfirmations from "@/components/klaf/KlafEventConfirmations";
import { usePreviewRole } from "@/lib/previewRoleContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { plugotFor, effectivePermissions } from "@/lib/permissions";
import { getFoodPickupState, FOOD_PICKUP_STATE_LABELS } from "@/lib/eventConfirmations";
import KlafMealRegulators from "@/components/klaf/KlafMealRegulators";
import { usePageTitleOverride } from "@/lib/pageTitleContext";

const WEEKDAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// One card per pluga the viewer is authorized for (meal_regulators is
// scoped, so several plugot at once is the common case, not the exception —
// an admin, via effectivePermissions, is implicitly authorized for all of
// them). Each pluga gets its own color-coded card so it's obvious which
// pluga's data is which.
function MealRegulatorsBreakdown({ plugot, dateStr }) {
  if (!plugot.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {plugot.map((p) => {
        const color = PLUGA_COLORS[p];
        return (
          <div key={p} className={cn("rounded-xl border-2 p-3", color?.light, color?.border)}>
            <p className="text-sm font-bold mb-2">{p}</p>
            <KlafMealRegulators pluga={p} dateStr={dateStr} />
          </div>
        );
      })}
    </div>
  );
}

// Builds the checkbox-style task list for one day, from that day's own
// routine/events/direct-tasks rows. Pulled out of the render so it can be run
// once per day of the "today through Saturday" window (see weekTasksByDay
// below) instead of just for whichever single day the schedule nav happens
// to be on.
function buildDayTasks(routine, dayEvents, dayDirectTasks, pluga, frisaExtraPlugot) {
  const tasks = [];

  if (routine) {
    if (routine.frisa_morning === pluga) {
      tasks.push({ type: "shotaf", id: routine.id, field: "frisa_morning", label: "משיכת פינת פריסה", icon: Sun });
    } else if (frisaExtraPlugot.includes(routine.frisa_morning)) {
      tasks.push({ type: "shotaf", id: routine.id, field: "frisa_morning", label: `משיכת פינת פריסה (עבור ${routine.frisa_morning})`, icon: Sun, completionPluga: routine.frisa_morning });
    } else if (!routine.frisa_morning || routine.frisa_morning === "טרם הוחלט") {
      tasks.push({ type: "shotaf", id: routine.id, field: "frisa_morning", label: "משיכת פינת פריסה", icon: Sun, unassigned: true });
    }
    if (routine.morning_assembly_plugas?.includes(pluga)) {
      tasks.push({ type: "shotaf", id: routine.id, field: "morning_assembly_plugas", label: "מסדר בוקר", icon: Users });
    } else if (!routine.morning_assembly_plugas?.length) {
      tasks.push({ type: "shotaf", id: routine.id, field: "morning_assembly_plugas", label: "מסדר בוקר", icon: Users, unassigned: true });
    }
    if (routine.noon_cleaning === pluga) {
      tasks.push({ type: "shotaf", id: routine.id, field: "noon_cleaning", label: "ניקוי צהריים - פינת פריסה ושירותים", icon: Sunset });
    } else if (!routine.noon_cleaning || routine.noon_cleaning === "טרם הוחלט") {
      tasks.push({ type: "shotaf", id: routine.id, field: "noon_cleaning", label: "ניקוי צהריים - פינת פריסה ושירותים", icon: Sunset, unassigned: true });
    }
    if (routine.evening_cleaning === pluga) {
      tasks.push({ type: "shotaf", id: routine.id, field: "evening_cleaning", label: "ניקוי ערב - פינת פריסה ושירותים", icon: Moon });
    } else if (!routine.evening_cleaning || routine.evening_cleaning === "טרם הוחלט") {
      tasks.push({ type: "shotaf", id: routine.id, field: "evening_cleaning", label: "ניקוי ערב - פינת פריסה ושירותים", icon: Moon, unassigned: true });
    }
  }

  dayEvents.forEach((e) => {
    if (e.event_type === "פנימי" && e.responsible_plugas?.includes(pluga)) {
      tasks.push({ type: "event", id: e.id, field: "responsible", label: e.title, icon: Users, event: e });
    }
    if (e.event_type === "חיצוני") {
      if (e.transport_pluga === pluga) {
        tasks.push({ type: "event", id: e.id, field: "transport", label: `${e.title} - הסעים`, icon: Truck, event: e });
      }
      if (e.food_pluga === pluga) {
        tasks.push({ type: "event", id: e.id, field: "food", label: `${e.title} - אוכל`, icon: UtensilsCrossed, event: e, foodPickupState: getFoodPickupState(e) });
      }
    }
  });

  dayDirectTasks.forEach((dt) => {
    tasks.push({ type: "direct", id: dt.id, field: dt.id, label: dt.title, icon: ClipboardList, directTask: dt });
  });

  return tasks;
}

function dayLabel(date, dateStr, todayStr, tomorrowStr) {
  if (dateStr === todayStr) return "היום";
  if (dateStr === tomorrowStr) return "מחר";
  return `יום ${WEEKDAY_NAMES[date.getDay()]}, ${date.getDate()}.${date.getMonth() + 1}`;
}

export default function Klaf() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [myPermissions, setMyPermissions] = useState([]);
  const { previewRole, previewPluga, setPreviewPluga } = usePreviewRole();
  // selectedDate now drives only the schedule ("לוז") side of the page —
  // KlafSchedule / KlafConstraints / KlafEventConfirmations / KlafSummary /
  // MealRegulatorsBreakdown. The task list below is independent of it: it
  // always covers today through this week's Saturday (see weekTasksByDay).
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const dateStr = toDateStr(selectedDate);
  const [routine, setRoutine] = useState(null);
  const [events, setEvents] = useState([]);
  const [directTasks, setDirectTasks] = useState([]);
  const [constraints, setConstraints] = useState([]);
  const [eventConfirmations, setEventConfirmations] = useState([]);
  const [eventContacts, setEventContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  // Task-list data: today through this week's Saturday, independent of
  // selectedDate above.
  const [weekRoutines, setWeekRoutines] = useState([]);
  const [weekEvents, setWeekEvents] = useState([]);
  const [weekDirectTasks, setWeekDirectTasks] = useState([]);
  const [weekCompletions, setWeekCompletions] = useState([]);
  const [weekLoading, setWeekLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Permissions delegated to *this signed-in user* (not the previewed role) —
  // right now only frisa_pina matters here: it lets someone complete the
  // "משיכת פינת פריסה" task on behalf of a pluga other than their own.
  useEffect(() => {
    if (!user?.id) { setMyPermissions([]); return; }
    base44.entities.UserPermission.filter({ user_id: user.id }).then(setMyPermissions).catch(() => setMyPermissions([]));
  }, [user?.id]);

  const effectiveRoleForLoad = previewRole || user?.role;
  const effectivePluga = previewRole === "קלפ" ? previewPluga : user?.pluga;

  // Schedule-side data for the single day the "לוז" nav is currently on.
  const loadData = useCallback(async () => {
    if (effectiveRoleForLoad !== "קלפ") return;
    if (!effectivePluga) return;
    setLoading(true);
    try {
      const [eventData, allDirectTaskData, constraintData, myConfirmations, allContacts] = await Promise.all([
        base44.entities.Event.filter({ event_date: dateStr }),
        base44.entities.DirectTask.filter({ task_date: dateStr }),
        // A constraint may target this pluga either via the singular `pluga`
        // column (how KlafConstraints.jsx itself saves one) or via the
        // `plugas` array (how the admin's multi-select "אילוצים" page saves
        // one) — fetch the day's constraints and match both shapes
        // client-side rather than filtering by `pluga` alone, so an
        // admin-created multi-pluga constraint still shows up here.
        base44.entities.Constraint.filter({ constraint_date: dateStr }),
        base44.entities.EventConfirmation.filter({ pluga: effectivePluga }),
        base44.entities.EventContact.list("-created_date", 500),
      ]);
      setEvents(eventData);
      setDirectTasks(allDirectTaskData.filter((dt) =>
        dt.pluga === effectivePluga ||
        (dt.responsible_plugas && dt.responsible_plugas.includes(effectivePluga))
      ));
      setConstraints(constraintData.filter((c) => c.pluga === effectivePluga || c.plugas?.includes(effectivePluga)));
      // Only today's events matter here; the confirmation feature is scoped
      // to the selected day like the rest of this page.
      const todaysEventIds = new Set(eventData.map((e) => e.id));
      const todaysConfirmations = myConfirmations.filter((c) => todaysEventIds.has(c.event_id));
      setEventConfirmations(todaysConfirmations);
      setEventContacts(allContacts.filter((c) => todaysEventIds.has(c.event_id)));
      // routine_date is still needed for the schedule too, fetched below via
      // the week range (weekRoutines already covers every day in the
      // "today..Saturday" window; when selectedDate falls outside that
      // window — the user browsed the schedule to a different day — fall
      // back to a direct single-day fetch).
      const routineData = await base44.entities.DailyRoutine.filter({ routine_date: dateStr });
      setRoutine(routineData[0] || null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRoleForLoad, effectivePluga, dateStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Task-list data: fetched once for the whole "today through Saturday"
  // window, independent of the schedule's selectedDate.
  const today = new Date();
  const todayStr = toDateStr(today);
  const daysUntilSaturday = 6 - today.getDay(); // getDay(): Sunday=0 ... Saturday=6
  const weekDates = Array.from({ length: daysUntilSaturday + 1 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });
  const weekStartStr = todayStr;
  const weekEndStr = toDateStr(weekDates[weekDates.length - 1]);

  const loadWeekData = useCallback(async () => {
    if (effectiveRoleForLoad !== "קלפ") return;
    if (!effectivePluga) return;
    setWeekLoading(true);
    try {
      const [routineData, eventData, completionData, allDirectTaskData] = await Promise.all([
        base44.entities.DailyRoutine.filter({ routine_date: { gte: weekStartStr, lte: weekEndStr } }),
        base44.entities.Event.filter({ event_date: { gte: weekStartStr, lte: weekEndStr } }),
        base44.entities.TaskCompletion.filter({ task_date: { gte: weekStartStr, lte: weekEndStr } }),
        base44.entities.DirectTask.filter({ task_date: { gte: weekStartStr, lte: weekEndStr } }),
      ]);
      setWeekRoutines(routineData);
      setWeekEvents(eventData);
      setWeekCompletions(completionData);
      setWeekDirectTasks(allDirectTaskData.filter((dt) =>
        dt.pluga === effectivePluga ||
        (dt.responsible_plugas && dt.responsible_plugas.includes(effectivePluga))
      ));
    } finally {
      setWeekLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRoleForLoad, effectivePluga, weekStartStr, weekEndStr]);

  useEffect(() => {
    loadWeekData();
  }, [loadWeekData]);

  const goPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const goNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  const goToday = () => setSelectedDate(new Date());

  // AppLayout's title bar shows "המשימות שלי" for this route by default
  // (src/lib/pageTitles.js), but this same route renders a completely
  // different, much narrower page below (see isDelegatedOnly further down)
  // for someone who only holds the delegated meal_regulators permission —
  // that view should say "מווסתים" instead. usePageTitleOverride is a hook,
  // so it has to be called unconditionally, before any of this component's
  // early returns below — hence this small early (and null-safe, since
  // `user` may still be loading) recomputation of the same isDelegatedOnly
  // condition computed again, in full, further down once `user` is known.
  const earlyEffectiveRole = previewRole || user?.role;
  const earlyIsKlaf = earlyEffectiveRole === "קלפ";
  // previewRole-aware — see the doc comment on effectivePermissions in
  // src/lib/permissions.js (a true role preview should reflect a plain
  // member of that role, not always the real signed-in admin's full access).
  const earlyDelegatedPermissions = effectivePermissions(myPermissions, earlyEffectiveRole);
  const earlyIsDelegatedOnly = !earlyIsKlaf && plugotFor(earlyDelegatedPermissions, "meal_regulators").length > 0;
  usePageTitleOverride(earlyIsDelegatedOnly ? "מווסתים" : null, earlyIsDelegatedOnly ? UtensilsCrossed : null);

  if (!user) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const effectiveRole = previewRole || user.role;
  const isKlaf = effectiveRole === "קלפ";
  // previewRole-aware — see the doc comment on effectivePermissions in
  // src/lib/permissions.js.
  const delegatedPermissions = effectivePermissions(myPermissions, effectiveRole);
  // Every pluga this signed-in user is authorized to manage meal regulators
  // for (see src/lib/permissions.js / AdminPanel's "הרשאות מיוחדות") — for
  // most קלפ holders that's just their own pluga, but a delegated grant (or
  // an admin's automatic one) can cover several at once. A non-קלפ holder of
  // this permission gets a minimal version of this page (see isDelegatedOnly
  // below) instead of being blocked outright.
  const regulatorPlugot = plugotFor(delegatedPermissions, "meal_regulators");
  const isDelegatedOnly = !isKlaf && regulatorPlugot.length > 0;

  if (!isKlaf && !isDelegatedOnly) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>דף זה זמין לקלפ בלבד</p>
      </div>
    );
  }

  if (isDelegatedOnly) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-1">
            <Button variant="outline" size="icon" onClick={goPrevDay}>
              <ChevronRight className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">{formatHebrewDate(selectedDate)}</h1>
            <Button variant="outline" size="icon" onClick={goNextDay}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </div>
          <button onClick={goToday} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            חזור להיום
          </button>
        </div>
        <MealRegulatorsBreakdown plugot={regulatorPlugot} dateStr={dateStr} />
      </div>
    );
  }

  const pluga = previewRole === "קלפ" ? previewPluga : user.pluga;
  if (!pluga) {
    return (
      <div className="text-center py-20 text-muted-foreground space-y-3">
        <p className="text-lg font-medium">לא נבחרה פלוגה</p>
        {previewRole === "קלפ" && (
          <Select value={previewPluga || ""} onValueChange={setPreviewPluga}>
            <SelectTrigger className="w-[180px] mx-auto"><SelectValue placeholder="בחר פלוגה לתצוגה" /></SelectTrigger>
            <SelectContent>
              {PLUGOT.map((p) => (
                <SelectItem key={p} value={p}>
                  <span className="flex items-center gap-2">
                    <span className={cn("w-3 h-3 rounded-full", PLUGA_COLORS[p]?.dot)} />
                    {p}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    );
  }
  const plugaColor = PLUGA_COLORS[pluga];
  // Only a real admin (using the preview mechanism to view a klaf's screen) should see
  // tasks that haven't been assigned to any pluga yet. A genuine קלפ user never sees them.
  const isAdminPreview = user.role === "admin";

  // Other plugot this signed-in user was delegated the frisa_pina permission
  // for (see src/lib/permissions.js / AdminPanel's "הרשאות מיוחדות"). Lets
  // them complete the frisa task below on a day it's assigned to one of
  // those plugot, not just their own.
  const frisaExtraPlugot = plugotFor(delegatedPermissions, "frisa_pina").filter((p) => p !== pluga);

  // Build schedule items (only tasks with times) for the selected day only —
  // unaffected by the task-list decoupling above.
  const scheduleItems = [];
  events.forEach((e) => {
    if (e.event_type === "פנימי" && e.responsible_plugas?.includes(pluga)) {
      scheduleItems.push({ title: e.title, start_time: e.start_time, end_time: e.end_time, type: "event" });
    }
    if (e.event_type === "חיצוני") {
      if (e.transport_pluga === pluga) {
        scheduleItems.push({ title: `${e.title} - הסעים`, start_time: e.start_time, end_time: e.end_time, type: "event" });
      }
      if (e.food_pluga === pluga) {
        scheduleItems.push({ title: `${e.title} - אוכל`, start_time: e.start_time, end_time: e.end_time, type: "event" });
      }
    }
  });
  directTasks.forEach((dt) => {
    if (dt.start_time) {
      scheduleItems.push({ title: dt.title, start_time: dt.start_time, end_time: dt.end_time, type: "direct" });
    }
  });
  // Constraints go on the same timeline as tasks (request: connect the day's
  // schedule to that day's constraints instead of showing them separately).
  constraints.forEach((c) => {
    scheduleItems.push({ title: c.title, start_time: c.start_time, end_time: c.end_time, type: "constraint", details: c.details });
  });
  scheduleItems.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  const isCompleted = (task, taskDateStr) => {
    return weekCompletions.some((c) => c.task_id === task.id && c.task_field === task.field && c.task_date === taskDateStr);
  };

  const getTaskTime = (task) => task.event?.start_time || task.directTask?.start_time || null;

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = toDateStr(tomorrow);

  // The task list itself: today through this week's Saturday, grouped by
  // day, each day built independently from the week-range data above.
  const weekTasksByDay = weekDates.map((d) => {
    const ds = toDateStr(d);
    const dayRoutine = weekRoutines.find((r) => r.routine_date === ds) || null;
    const dayEvents = weekEvents.filter((e) => e.event_date === ds);
    const dayDirectTasks = weekDirectTasks.filter((dt) => dt.task_date === ds);
    const dayTasksRaw = buildDayTasks(dayRoutine, dayEvents, dayDirectTasks, pluga, frisaExtraPlugot);
    // Tasks not yet assigned to any pluga are admin-preview-only; a klaf
    // viewing their own screen should never see them.
    const dayVisible = isAdminPreview ? dayTasksRaw : dayTasksRaw.filter((t) => !t.unassigned);
    // Open tasks before completed ones, timed tasks in chronological order,
    // untimed (shotaf-style) tasks grouped at the end.
    const daySorted = [...dayVisible].sort((a, b) => {
      const aDone = isCompleted(a, ds);
      const bDone = isCompleted(b, ds);
      if (aDone !== bDone) return aDone ? 1 : -1;
      const aTime = getTaskTime(a);
      const bTime = getTaskTime(b);
      if (aTime && bTime) return aTime.localeCompare(bTime);
      if (aTime) return -1;
      if (bTime) return 1;
      return 0;
    });
    const dayCompletedCount = dayVisible.filter((t) => isCompleted(t, ds)).length;
    return {
      date: d,
      dateStr: ds,
      label: dayLabel(d, ds, todayStr, tomorrowStr),
      tasks: daySorted,
      total: dayVisible.length,
      completedCount: dayCompletedCount,
    };
  });

  const allVisibleCount = weekTasksByDay.reduce((sum, day) => sum + day.total, 0);
  const allCompletedCount = weekTasksByDay.reduce((sum, day) => sum + day.completedCount, 0);
  const daysWithTasks = weekTasksByDay.filter((day) => day.total > 0);

  const toggleCompletion = async (task, taskDateStr) => {
    const key = `${taskDateStr}_${task.id}_${task.field}`;
    setToggling(key);
    try {
      const existing = weekCompletions.find((c) => c.task_id === task.id && c.task_field === task.field && c.task_date === taskDateStr);
      if (existing) {
        await base44.entities.TaskCompletion.delete(existing.id);
      } else {
        await base44.entities.TaskCompletion.create({
          task_type: task.type,
          task_id: task.id,
          task_field: task.field,
          task_label: task.label,
          task_date: taskDateStr,
          // A frisa_pina-delegated task is completed on behalf of the
          // pluga it's actually assigned to that day, not the viewer's own.
          pluga: task.completionPluga || pluga,
        });
      }
      await loadWeekData();
    } finally {
      setToggling(null);
    }
  };

  const handleDirectTaskSubmit = async (formData) => {
    await base44.entities.DirectTask.create(formData);
    await Promise.all([loadData(), loadWeekData()]);
  };

  // שוטף tasks open the שוטף tab itself (not the default "סיכום מסדר" tab
  // that the old "/shotaf" redirect landed on), on that task's own day.
  const handleTaskClick = (task, taskDateStr) => {
    if (task.type === "event") {
      navigate("/constraints");
    } else if (task.type === "shotaf") {
      navigate(`/daily-summary?tab=shotaf${taskDateStr ? `&date=${taskDateStr}` : ""}`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className={cn("rounded-xl border-2 p-3 flex items-center justify-between flex-wrap gap-2", plugaColor.light, plugaColor.border)}>
        <div className="flex items-center gap-2">
          {previewRole === "קלפ" ? (
            <Select value={previewPluga || ""} onValueChange={setPreviewPluga}>
              <SelectTrigger className="w-[150px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLUGOT.map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className="flex items-center gap-2">
                      <span className={cn("w-3 h-3 rounded-full", PLUGA_COLORS[p]?.dot)} />
                      {p}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-medium">
              הפלוגה שלך: <span className="font-bold">{pluga}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!weekLoading && allVisibleCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {allCompletedCount}/{allVisibleCount} הושלמו
            </p>
          )}
          <Button size="sm" onClick={() => setFormOpen(true)} className="gap-1">
            <Plus className="w-4 h-4" />
            הוסף משימה
          </Button>
        </div>
      </div>

      {!weekLoading && allVisibleCount > 0 && (
        <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", plugaColor.bg)}
            style={{ width: `${Math.round((allCompletedCount / allVisibleCount) * 100)}%` }}
          />
        </div>
      )}

      {!weekLoading && allVisibleCount - allCompletedCount > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-2.5 flex items-center gap-2 text-amber-800">
          <BellRing className="w-4 h-4 shrink-0" />
          <p className="text-sm font-medium">
            יש לך {allVisibleCount - allCompletedCount} משימות פתוחות עד סוף השבוע
          </p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Task List - right side in RTL. Independent of the schedule's date
            nav below: always today through this week's Saturday. */}
        <div className="lg:w-1/2 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">רשימת משימות — עד סוף השבוע</h2>
          {weekLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : daysWithTasks.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border border-border rounded-xl bg-white">
              <p className="text-sm font-medium">אין משימות עד סוף השבוע</p>
            </div>
          ) : (
            daysWithTasks.map((day) => (
              <div key={day.dateStr} className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500">
                  {day.label}
                  <span className="text-slate-400 font-normal"> · {day.completedCount}/{day.total}</span>
                </h3>
                {day.tasks.map((task, i) => {
                  const completed = isCompleted(task, day.dateStr);
                  const key = `${day.dateStr}_${task.id}_${task.field}`;
                  const Icon = task.icon;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "rounded-xl border-2 p-3 flex items-center gap-3 transition-colors",
                        completed ? "bg-green-50 border-green-300" : task.unassigned ? "bg-amber-50 border-amber-300" : cn(plugaColor.light, plugaColor.border)
                      )}
                    >
                      <button
                        onClick={() => toggleCompletion(task, day.dateStr)}
                        disabled={toggling === key}
                        className="shrink-0"
                      >
                        {toggling === key ? (
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        ) : completed ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                          <Icon className="w-4 h-4 text-slate-500 shrink-0" />
                          <p className={cn("font-medium text-sm break-words", completed && "line-through text-muted-foreground")}>
                            {task.label}
                          </p>
                          {task.unassigned && (
                            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              טרם הוחלט
                            </span>
                          )}
                          {task.foodPickupState && task.foodPickupState !== "upcoming" && (
                            <span className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded-full",
                              task.foodPickupState === "overdue" ? "text-red-700 bg-red-100" :
                              task.foodPickupState === "urgent" ? "text-amber-700 bg-amber-100" :
                              "text-blue-700 bg-blue-100"
                            )}>
                              {FOOD_PICKUP_STATE_LABELS[task.foodPickupState]}
                            </span>
                          )}
                        </div>
                        {task.event && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {task.event.start_time} - {task.event.end_time}
                          </p>
                        )}
                        {task.directTask?.start_time && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {task.directTask.start_time}{task.directTask.end_time ? ` - ${task.directTask.end_time}` : ""}
                          </p>
                        )}
                      </div>
                      {task.type !== "direct" && (
                        <button
                          onClick={() => handleTaskClick(task, day.dateStr)}
                          className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                          title="קפוץ למקור"
                        >
                          <ExternalLink className="w-4 h-4 text-slate-500" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Schedule - left side in RTL. Still driven by the date nav (dateStr). */}
        <div className="lg:w-1/2">
          <div className="text-center mb-3">
            <div className="flex items-center justify-center gap-3 mb-1">
              <Button variant="outline" size="icon" onClick={goPrevDay}>
                <ChevronRight className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-bold">{formatHebrewDate(selectedDate)}</h1>
              <Button variant="outline" size="icon" onClick={goNextDay}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </div>
            <button onClick={goToday} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              חזור להיום
            </button>
          </div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-muted-foreground">לוז יומי</h2>
            {constraints.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-100 border-2 border-dashed border-red-400" />
                אילוץ
              </span>
            )}
          </div>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <KlafSchedule items={scheduleItems} pluga={pluga} />
          )}
        </div>
      </div>

      <KlafEventConfirmations
        events={events}
        pluga={pluga}
        confirmations={eventConfirmations}
        contacts={eventContacts}
        onChange={loadData}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
        <KlafConstraints pluga={pluga} dateStr={dateStr} onChange={loadData} />
        <KlafSummary dateStr={dateStr} />
      </div>

      {regulatorPlugot.length > 0 && (
        <div className="mt-2">
          <MealRegulatorsBreakdown plugot={regulatorPlugot} dateStr={dateStr} />
        </div>
      )}

      <DirectTaskForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleDirectTaskSubmit}
        defaultPluga={pluga}
        defaultDate={dateStr}
      />
    </div>
  );
}
