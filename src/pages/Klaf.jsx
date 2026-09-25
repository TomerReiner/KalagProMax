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

export default function Klaf() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const { previewRole, previewPluga, setPreviewPluga } = usePreviewRole();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const dateStr = toDateStr(selectedDate);
  const [routine, setRoutine] = useState(null);
  const [events, setEvents] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [directTasks, setDirectTasks] = useState([]);
  const [constraints, setConstraints] = useState([]);
  const [eventConfirmations, setEventConfirmations] = useState([]);
  const [eventContacts, setEventContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    const effectivePluga = previewRole === "קלפ" ? previewPluga : user?.pluga;
    if (!effectivePluga) return;
    setLoading(true);
    try {
      const [routineData, eventData, completionData, allDirectTaskData, constraintData, myConfirmations, allContacts] = await Promise.all([
        base44.entities.DailyRoutine.filter({ routine_date: dateStr }),
        base44.entities.Event.filter({ event_date: dateStr }),
        base44.entities.TaskCompletion.filter({ task_date: dateStr }),
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
      setRoutine(routineData[0] || null);
      setEvents(eventData);
      setCompletions(completionData);
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
    } finally {
      setLoading(false);
    }
  }, [user, dateStr, previewRole, previewPluga]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  if (!user) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const effectiveRole = previewRole || user.role;
  if (effectiveRole !== "קלפ") {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>דף זה זמין לקלפ בלבד</p>
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
                <SelectItem key={p} value={p}>{p}</SelectItem>
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

  // Build tasks (list)
  const tasks = [];

  if (routine) {
    if (routine.frisa_morning === pluga) {
      tasks.push({ type: "shotaf", id: routine.id, field: "frisa_morning", label: "משיכת פינת פריסה", icon: Sun });
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

  events.forEach((e) => {
    if (e.event_type === "פנימי" && e.responsible_plugas?.includes(pluga)) {
      tasks.push({ type: "event", id: e.id, field: "responsible", label: e.title, icon: Users, event: e });
    }
    if (e.event_type === "חיצוני") {
      if (e.transport_pluga === pluga) {
        tasks.push({ type: "event", id: e.id, field: "transport", label: `${e.title} - הסעים`, icon: Truck, event: e });
      }
      if (e.food_pluga === pluga) {
        tasks.push({ type: "event", id: e.id, field: "food", label: `${e.title} - אוכל`, icon: UtensilsCrossed, event: e });
      }
    }
  });

  directTasks.forEach((dt) => {
    tasks.push({ type: "direct", id: dt.id, field: dt.id, label: dt.title, icon: ClipboardList, directTask: dt });
  });

  // Build schedule items (only tasks with times)
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

  const isCompleted = (task) => {
    return completions.some((c) => c.task_id === task.id && c.task_field === task.field);
  };

  // Tasks not yet assigned to any pluga are admin-preview-only; a klaf viewing their own
  // screen should never see them.
  const visibleTasks = isAdminPreview ? tasks : tasks.filter((t) => !t.unassigned);

  const getTaskTime = (task) => task.event?.start_time || task.directTask?.start_time || null;

  // Nicer, sorted layout: open tasks before completed ones, timed tasks in chronological
  // order, and untimed (shotaf-style) tasks grouped at the end of each group.
  const sortedTasks = [...visibleTasks].sort((a, b) => {
    const aDone = isCompleted(a);
    const bDone = isCompleted(b);
    if (aDone !== bDone) return aDone ? 1 : -1;
    const aTime = getTaskTime(a);
    const bTime = getTaskTime(b);
    if (aTime && bTime) return aTime.localeCompare(bTime);
    if (aTime) return -1;
    if (bTime) return 1;
    return 0;
  });

  const toggleCompletion = async (task) => {
    const key = `${task.id}_${task.field}`;
    setToggling(key);
    try {
      const existing = completions.find((c) => c.task_id === task.id && c.task_field === task.field);
      if (existing) {
        await base44.entities.TaskCompletion.delete(existing.id);
      } else {
        await base44.entities.TaskCompletion.create({
          task_type: task.type,
          task_id: task.id,
          task_field: task.field,
          task_label: task.label,
          task_date: dateStr,
          pluga,
        });
      }
      await loadData();
    } finally {
      setToggling(null);
    }
  };

  const handleDirectTaskSubmit = async (formData) => {
    await base44.entities.DirectTask.create(formData);
    await loadData();
  };

  const handleTaskClick = (task) => {
    if (task.type === "event") {
      navigate("/constraints");
    } else if (task.type === "shotaf") {
      navigate("/shotaf");
    }
  };

  const completedCount = visibleTasks.filter(isCompleted).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
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

      <div className={cn("rounded-xl border-2 p-3 flex items-center justify-between", plugaColor.light, plugaColor.border)}>
        <div className="flex items-center gap-2">
          {previewRole === "קלפ" ? (
            <Select value={previewPluga || ""} onValueChange={setPreviewPluga}>
              <SelectTrigger className="w-[150px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLUGOT.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
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
          {!loading && visibleTasks.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {completedCount}/{visibleTasks.length} הושלמו
            </p>
          )}
          <Button size="sm" onClick={() => setFormOpen(true)} className="gap-1">
            <Plus className="w-4 h-4" />
            הוסף משימה
          </Button>
        </div>
      </div>

      {!loading && visibleTasks.length > 0 && (
        <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", plugaColor.bg)}
            style={{ width: `${Math.round((completedCount / visibleTasks.length) * 100)}%` }}
          />
        </div>
      )}

      {!loading && visibleTasks.length - completedCount > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-2.5 flex items-center gap-2 text-amber-800">
          <BellRing className="w-4 h-4 shrink-0" />
          <p className="text-sm font-medium">
            יש לך {visibleTasks.length - completedCount} משימות פתוחות היום
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Task List - right side in RTL */}
          <div className="lg:w-1/2 space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">רשימת משימות</h2>
            {visibleTasks.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground border border-border rounded-xl bg-white">
                <p className="text-sm font-medium">אין משימות להיום</p>
              </div>
            ) : (
              sortedTasks.map((task, i) => {
                const completed = isCompleted(task);
                const key = `${task.id}_${task.field}`;
                const Icon = task.icon;
                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-xl border-2 p-3 flex items-center gap-3 transition-colors",
                      completed ? "bg-green-50 border-green-300" : task.unassigned ? "bg-amber-50 border-amber-300" : "bg-white border-border"
                    )}
                  >
                    <button
                      onClick={() => toggleCompletion(task)}
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
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-slate-500 shrink-0" />
                        <p className={cn("font-medium text-sm", completed && "line-through text-muted-foreground")}>
                          {task.label}
                        </p>
                        {task.unassigned && (
                          <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            טרם הוחלט
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
                        onClick={() => handleTaskClick(task)}
                        className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        title="קפוץ למקור"
                      >
                        <ExternalLink className="w-4 h-4 text-slate-500" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Schedule - left side in RTL */}
          <div className="lg:w-1/2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-muted-foreground">לוז יומי</h2>
              {constraints.length > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-100 border-2 border-dashed border-red-400" />
                  אילוץ
                </span>
              )}
            </div>
            <KlafSchedule items={scheduleItems} pluga={pluga} />
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
        </>
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