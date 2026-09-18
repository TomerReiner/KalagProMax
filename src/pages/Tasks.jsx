import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight, ChevronLeft, ClipboardList, Archive, RefreshCw, AlertCircle, Plus, CheckCircle2 } from "lucide-react";
import StandaloneTaskForm from "@/components/tasks/StandaloneTaskForm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLUGOT, PLUGA_COLORS, formatHebrewDate, toDateStr } from "@/lib/constants";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDateOnly(dateStr) {
  if (!dateStr) return "";
  return String(dateStr).split("T")[0];
}

const SHOTAF_FIELDS = [
  { field: "frisa_morning", label: "משיכת פינת פריסה" },
  { field: "noon_cleaning", label: "ניקוי צהריים" },
  { field: "evening_cleaning", label: "ניקוי ערב" },
];

export default function Tasks() {
  const [viewMode, setViewMode] = useState("day");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [events, setEvents] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [directTasks, setDirectTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [plugaFilter, setPlugaFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("open");
  const [showArchive, setShowArchive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const navigate = useNavigate();

  const loadAll = useCallback(async () => {
    try {
      const [eventData, routineData, directTaskData] = await Promise.all([
        base44.entities.Event.list("-event_date", 500),
        base44.entities.DailyRoutine.list("-routine_date", 500),
        base44.entities.DirectTask.list("-task_date", 500),
      ]);
      setEvents(eventData);
      setRoutines(routineData);
      setDirectTasks(directTaskData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const dateLabel = viewMode === "day"
    ? formatHebrewDate(selectedDate)
    : `${days[0].getDate()}/${days[0].getMonth() + 1} - ${days[6].getDate()}/${days[6].getMonth() + 1}`;

  const allTasks = useMemo(() => {
    const result = [];
    const dates = viewMode === "day"
      ? [toDateStr(selectedDate)]
      : days.map((d) => toDateStr(d));

    dates.forEach((dateStr) => {
      events
        .filter((e) => getDateOnly(e.event_date) === dateStr)
        .forEach((e) => {
          if (e.event_type === "חיצוני") {
            result.push({
              id: `${e.id}-transport`,
              type: "event",
              subtype: "הסעים",
              title: e.title,
              date: dateStr,
              time: `${e.start_time} - ${e.end_time}`,
              pluga: e.transport_pluga || "",
              assigned: !!e.transport_pluga,
              details: e.transport_details,
            });
            result.push({
              id: `${e.id}-food`,
              type: "event",
              subtype: "אוכל",
              title: e.title,
              date: dateStr,
              time: `${e.start_time} - ${e.end_time}`,
              pluga: e.food_pluga || "",
              assigned: !!e.food_pluga,
              details: e.food_details,
            });
          } else {
            const assigned = e.responsible_plugas && e.responsible_plugas.length > 0;
            result.push({
              id: `${e.id}-responsible`,
              type: "event",
              subtype: "פנימי",
              title: e.title,
              date: dateStr,
              time: `${e.start_time} - ${e.end_time}`,
              plugas: e.responsible_plugas || [],
              assigned,
              details: e.details,
            });
          }
        });

      directTasks
        .filter((dt) => getDateOnly(dt.task_date) === dateStr)
        .forEach((dt) => {
          const plugas = dt.responsible_plugas?.length ? dt.responsible_plugas : (dt.pluga ? [dt.pluga] : []);
          result.push({
            id: dt.id,
            type: "direct",
            subtype: "משימה ישירה",
            title: dt.title,
            date: dateStr,
            time: dt.start_time ? `${dt.start_time}${dt.end_time ? ` - ${dt.end_time}` : ""}` : null,
            pluga: dt.pluga,
            plugas,
            assigned: dt.status === "טופלה",
            details: dt.notes,
            directTaskId: dt.id,
          });
        });

      const routine = routines.find((r) => getDateOnly(r.routine_date) === dateStr);
      if (routine) {
        SHOTAF_FIELDS.forEach(({ field, label }) => {
          const value = routine[field];
          const isUnassigned = !value || value === "טרם הוחלט";
          result.push({
            id: `${routine.id}-${field}`,
            type: "shotaf",
            subtype: label,
            title: label,
            date: dateStr,
            time: null,
            pluga: isUnassigned ? "" : value,
            assigned: !isUnassigned,
          });
        });
      }
    });

    return result;
  }, [events, routines, directTasks, viewMode, selectedDate, days]);

  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (statusFilter === "open" && t.assigned) return false;
      if (plugaFilter !== "all") {
        if (t.type === "direct") {
          const plugas = t.plugas || (t.pluga ? [t.pluga] : []);
          if (!plugas.includes(plugaFilter)) return false;
        } else if (t.assigned) {
          if (t.plugas) {
            if (!t.plugas.includes(plugaFilter)) return false;
          } else if (t.pluga !== plugaFilter) {
            return false;
          }
        }
      }
      return true;
    });
  }, [allTasks, statusFilter, plugaFilter]);

  const archivedTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (!t.assigned) return false;
      if (plugaFilter !== "all") {
        if (t.type === "direct") {
          const plugas = t.plugas || (t.pluga ? [t.pluga] : []);
          if (!plugas.includes(plugaFilter)) return false;
        } else if (t.plugas) {
          return t.plugas.includes(plugaFilter);
        } else {
          return t.pluga === plugaFilter;
        }
      }
      return true;
    });
  }, [allTasks, plugaFilter]);

  const unassignedEventTasks = useMemo(() => {
    const result = [];
    events.forEach((e) => {
      const dateStr = getDateOnly(e.event_date);
      if (e.event_type === "חיצוני") {
        if (!e.transport_pluga || e.transport_pluga === "טרם הוחלט") {
          result.push({
            id: `${e.id}-transport`,
            type: "event",
            subtype: "הסעים",
            title: e.title,
            date: dateStr,
            dateLabel: formatHebrewDate(e.event_date),
            time: `${e.start_time} - ${e.end_time}`,
            pluga: "",
            assigned: false,
          });
        }
        if (!e.food_pluga || e.food_pluga === "טרם הוחלט") {
          result.push({
            id: `${e.id}-food`,
            type: "event",
            subtype: "אוכל",
            title: e.title,
            date: dateStr,
            dateLabel: formatHebrewDate(e.event_date),
            time: `${e.start_time} - ${e.end_time}`,
            pluga: "",
            assigned: false,
          });
        }
      } else {
        if (!e.responsible_plugas || e.responsible_plugas.length === 0) {
          result.push({
            id: `${e.id}-responsible`,
            type: "event",
            subtype: "פנימי",
            title: e.title,
            date: dateStr,
            dateLabel: formatHebrewDate(e.event_date),
            time: `${e.start_time} - ${e.end_time}`,
            plugas: [],
            assigned: false,
          });
        }
      }
    });
    result.sort((a, b) => new Date(a.date) - new Date(b.date));
    return result;
  }, [events]);

  const groupedTasks = useMemo(() => {
    if (viewMode === "day") return [];
    return days.map((d) => {
      const dateStr = toDateStr(d);
      return {
        dateStr,
        dayName: DAY_NAMES[d.getDay()],
        dayNum: d.getDate(),
        month: d.getMonth() + 1,
        tasks: filteredTasks.filter((t) => t.date === dateStr),
      };
    }).filter((g) => g.tasks.length > 0);
  }, [filteredTasks, viewMode, days]);

  const handleCreateTask = async (formData) => {
    await base44.entities.DirectTask.create(formData);
    await loadAll();
  };

  const handleMarkDone = async (e, taskId) => {
    e.stopPropagation();
    await base44.entities.DirectTask.update(taskId, { status: "טופלה" });
    await loadAll();
  };

  const handleTaskClick = (task) => {
    if (task.type === "shotaf") {
      navigate("/shotaf");
    } else if (task.type === "event") {
      navigate("/constraints");
    } else if (task.type === "direct") {
      navigate("/klaf");
    }
  };

  const goPrev = () => {
    if (viewMode === "day") {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 1);
      setSelectedDate(d);
    } else {
      const d = new Date(weekStart);
      d.setDate(d.getDate() - 7);
      setWeekStart(d);
    }
  };

  const goNext = () => {
    if (viewMode === "day") {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 1);
      setSelectedDate(d);
    } else {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + 7);
      setWeekStart(d);
    }
  };

  const goToday = () => {
    setSelectedDate(new Date());
    setWeekStart(getWeekStart(new Date()));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">משימות</h1>
            <p className="text-xs text-muted-foreground">משימות פתוחות וארכיון</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)} className="gap-1">
          <Plus className="w-4 h-4" />
          משימה חדשה
        </Button>
      </div>

      <div className="flex items-center justify-between bg-white rounded-xl border border-border p-3 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goPrev}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goNext}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" onClick={goToday} className="text-sm">היום</Button>
          <Button variant="outline" size="icon" onClick={loadAll} title="רענן משימות">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-sm font-medium">{dateLabel}</p>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode("day")}
            className={cn("px-3 py-1.5 text-sm rounded-md transition-colors", viewMode === "day" ? "bg-white shadow-sm font-medium" : "text-muted-foreground")}
          >
            יומי
          </button>
          <button
            onClick={() => setViewMode("week")}
            className={cn("px-3 py-1.5 text-sm rounded-md transition-colors", viewMode === "week" ? "bg-white shadow-sm font-medium" : "text-muted-foreground")}
          >
            שבועי
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={plugaFilter} onValueChange={setPlugaFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הפלוגות</SelectItem>
            {PLUGOT.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setStatusFilter("open")}
            className={cn("px-3 py-1.5 text-sm rounded-md transition-colors", statusFilter === "open" ? "bg-white shadow-sm font-medium" : "text-muted-foreground")}
          >
            פתוחות
          </button>
          <button
            onClick={() => setStatusFilter("all")}
            className={cn("px-3 py-1.5 text-sm rounded-md transition-colors", statusFilter === "all" ? "bg-white shadow-sm font-medium" : "text-muted-foreground")}
          >
            הכל
          </button>
        </div>
      </div>

      {!loading && unassignedEventTasks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
            <AlertCircle className="w-4 h-4" />
            <p className="text-sm font-semibold">משימות לשיבוץ ({unassignedEventTasks.length})</p>
          </div>
          <div className="space-y-2">
            {unassignedEventTasks.map((t) => (
              <TaskCard key={t.id} task={t} onClick={() => navigate("/constraints")} />
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">
            {statusFilter === "open" ? "אין משימות פתוחות" : "אין משימות להצגה"}
          </p>
          {statusFilter === "open" && <p className="text-sm mt-1">כל המשימות שויכו לפלוגות.</p>}
        </div>
      ) : viewMode === "week" ? (
        <div className="space-y-4">
          {groupedTasks.map((group, i) => (
            <div key={i} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {group.dayName} - {group.dayNum}/{group.month}
              </h3>
              <div className="space-y-2">
                {group.tasks.map((t) => (
                  <TaskCard key={t.id} task={t} onClick={() => handleTaskClick(t)} onMarkDone={t.type === "direct" ? handleMarkDone : undefined} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((t) => (
            <TaskCard key={t.id} task={t} onClick={() => handleTaskClick(t)} onMarkDone={t.type === "direct" ? handleMarkDone : undefined} />
          ))}
        </div>
      )}

      {archivedTasks.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowArchive(!showArchive)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Archive className="w-4 h-4" />
            ארכיון ({archivedTasks.length})
            <ChevronLeft className={cn("w-4 h-4 transition-transform", showArchive && "-rotate-90")} />
          </button>
          {showArchive && (
            <div className="space-y-2">
              {archivedTasks.map((t) => (
                <TaskCard key={t.id} task={t} onClick={() => handleTaskClick(t)} onMarkDone={t.type === "direct" ? handleMarkDone : undefined} />
              ))}
            </div>
          )}
        </div>
      )}

      <StandaloneTaskForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreateTask}
        defaultDate={toDateStr(selectedDate)}
      />
    </div>
  );
}

function TaskCard({ task, onClick, onMarkDone }) {
  const isEvent = task.type === "event";
  const isDirect = task.type === "direct";
  const typeLabel = isEvent ? "א" : isDirect ? "מ" : "ש";
  const typeBg = isEvent ? "bg-amber-200 text-amber-900" : isDirect ? "bg-purple-200 text-purple-900" : "bg-slate-200 text-slate-700";
  const plugaColor = task.pluga ? PLUGA_COLORS[task.pluga] : null;

  return (
    <div onClick={onClick} className={cn(
      "rounded-lg border p-3 flex items-start gap-3 cursor-pointer hover:shadow-md transition-shadow",
      task.assigned ? "bg-white border-border opacity-75" : "bg-amber-50 border-amber-200"
    )}>
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold",
        typeBg
      )}>
        {typeLabel}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{task.title}</p>
          <span className="text-xs text-muted-foreground">{task.subtype}</span>
          {task.dateLabel && (
            <span className="text-xs text-muted-foreground">· {task.dateLabel}</span>
          )}
        </div>
        {task.time && (
          <p className="text-xs text-muted-foreground mt-0.5">{task.time}</p>
        )}
        {task.details && (
          <p className="text-xs text-muted-foreground mt-1">{task.details}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {task.type === "direct" && !task.assigned && onMarkDone && (
          <button
            onClick={(e) => onMarkDone(e, task.directTaskId)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium hover:bg-green-200 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            סיים
          </button>
        )}
        {task.assigned ? (
          task.plugas && task.plugas.length > 0 ? (
            <div className="flex flex-wrap gap-1 justify-end max-w-[150px]">
              {task.plugas.map((p) => (
                <span key={p} className={cn("text-xs px-2 py-0.5 rounded-full", PLUGA_COLORS[p]?.light || "bg-muted")}>
                  {p}
                </span>
              ))}
            </div>
          ) : task.pluga ? (
            <span className={cn("text-xs px-2 py-1 rounded-full font-medium", plugaColor?.light || "bg-muted")}>
              {task.pluga}
            </span>
          ) : (
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
              הושלם
            </span>
          )
        ) : task.type === "direct" ? null : (
          <span className="text-xs px-2 py-1 rounded-full bg-amber-200 text-amber-900 font-medium">
            טרם הוחלט
          </span>
        )}
      </div>
    </div>
  );
}