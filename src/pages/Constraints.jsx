import React, { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, ChevronRight, ChevronLeft, CalendarRange, Repeat, ClipboardCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLUGOT, PLUGA_COLORS, EVENT_COLORS, toDateStr, formatHebrewDate, getShotafTime, SHOTAF_FIELD_LABELS } from "@/lib/constants";
import TimeInput from "@/components/TimeInput";
import EventForm from "@/components/constraints/EventForm";
import RecurringManageDialog from "@/components/constraints/RecurringManageDialog";
import EventConfirmationsOverview from "@/components/constraints/EventConfirmationsOverview";
import { cn } from "@/lib/utils";
import { computeLayout } from "@/lib/calendarLayout";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HOUR_START = 6;
const HOUR_END = 23;
const HOUR_HEIGHT = 40;

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function timeToPx(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  const hours = h + m / 60;
  const clamped = Math.max(HOUR_START, Math.min(HOUR_END, hours));
  return (clamped - HOUR_START) * HOUR_HEIGHT;
}

function getDateOnly(dateStr) {
  if (!dateStr) return "";
  return String(dateStr).split("T")[0];
}

export default function Constraints() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [viewMode, setViewMode] = useState("week");
  const [constraints, setConstraints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewConstraint, setViewConstraint] = useState(null);
  const [editing, setEditing] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventEditing, setEventEditing] = useState(null);
  const [viewEvent, setViewEvent] = useState(null);
  const [recurringEvents, setRecurringEvents] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [recurringOverrides, setRecurringOverrides] = useState([]);
  const [recurringManageOpen, setRecurringManageOpen] = useState(false);
  const [confirmationsOverviewOpen, setConfirmationsOverviewOpen] = useState(false);
  const [viewRecurring, setViewRecurring] = useState(null);
  const [moveDate, setMoveDate] = useState("");
  const [viewShotafTask, setViewShotafTask] = useState(null);
  const [shotafPluga, setShotafPluga] = useState("");

  const [form, setForm] = useState({
    plugas: [],
    constraint_date: toDateStr(new Date()),
    start_time: "08:00",
    end_time: "10:00",
    title: "",
    details: "",
  });

  const toggleFormPluga = (p) => {
    setForm((prev) => ({
      ...prev,
      plugas: prev.plugas.includes(p)
        ? prev.plugas.filter((x) => x !== p)
        : [...prev.plugas, p],
    }));
  };

  const days = useMemo(() => {
    if (viewMode === "day") {
      return [new Date(weekStart)];
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart, viewMode]);

  const loadConstraints = useCallback(async () => {
    try {
      const data = await base44.entities.Constraint.list("-constraint_date", 500);
      setConstraints(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConstraints();
  }, [loadConstraints]);

  const loadEvents = useCallback(async () => {
    try {
      const data = await base44.entities.Event.list("-event_date", 500);
      setEvents(data);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const loadRoutines = useCallback(async () => {
    try {
      const data = await base44.entities.DailyRoutine.list("-routine_date", 500);
      setRoutines(data);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadRoutines();
  }, [loadRoutines]);

  const loadRecurring = useCallback(async () => {
    try {
      const [reData, ovData] = await Promise.all([
        base44.entities.RecurringEvent.list("-created_date", 500),
        base44.entities.RecurringOverride.list("-created_date", 500),
      ]);
      setRecurringEvents(reData);
      setRecurringOverrides(ovData);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadRecurring();
  }, [loadRecurring]);

  const handleEventSubmit = async (formData) => {
    if (eventEditing) {
      await base44.entities.Event.update(eventEditing.id, formData);
      setEventEditing(null);
    } else {
      await base44.entities.Event.create(formData);
    }
    await loadEvents();
  };

  const handleEventDelete = async (id) => {
    await base44.entities.Event.delete(id);
    setViewEvent(null);
    await loadEvents();
  };

  const openEventEdit = (e) => {
    setViewEvent(null);
    setEventEditing(e);
    setEventFormOpen(true);
  };

  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
  const totalHeight = (HOUR_END - HOUR_START) * HOUR_HEIGHT;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.plugas.length || !form.title || !form.start_time || !form.end_time) return;
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.Constraint.update(editing.id, form);
        setEditing(null);
      } else {
        await base44.entities.Constraint.create(form);
      }
      setFormOpen(false);
      setForm({ plugas: [], constraint_date: toDateStr(new Date()), start_time: "08:00", end_time: "10:00", title: "", details: "" });
      await loadConstraints();
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (c) => {
    setViewConstraint(null);
    setEditing(c);
    setForm({
      plugas: c.plugas || (c.pluga ? [c.pluga] : []),
      constraint_date: getDateOnly(c.constraint_date) || toDateStr(new Date()),
      start_time: c.start_time || "08:00",
      end_time: c.end_time || "10:00",
      title: c.title || "",
      details: c.details || "",
    });
    setFormOpen(true);
  };

  const handleDelete = async (id) => {
    await base44.entities.Constraint.delete(id);
    await loadConstraints();
  };

  const goPrev = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - (viewMode === "day" ? 1 : 7));
    setWeekStart(d);
  };

  const goNext = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + (viewMode === "day" ? 1 : 7));
    setWeekStart(d);
  };

  const goToday = () => {
    setWeekStart(viewMode === "day" ? new Date() : getWeekStart(new Date()));
  };

  const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  const getRecurringForDate = (date) => {
    const dStr = toDateStr(date);
    const dayKey = DAY_KEYS[date.getDay()];
    const result = [];
    recurringEvents.forEach((re) => {
      const matches = re.recurrence === "daily" || re.recurrence === dayKey;
      if (!matches) return;
      const movedAway = recurringOverrides.find(
        (o) => o.recurring_event_id === re.id && o.original_date === dStr
      );
      if (!movedAway) {
        result.push({ ...re, isRecurring: true, originalDate: dStr });
      }
    });
    recurringOverrides.forEach((o) => {
      if (o.new_date !== dStr) return;
      const re = recurringEvents.find((r) => r.id === o.recurring_event_id);
      if (re) {
        result.push({ ...re, isRecurring: true, isOverride: true, originalDate: o.original_date, overrideId: o.id });
      }
    });
    return result;
  };

  const handleRecurringMove = async () => {
    if (!viewRecurring || !moveDate) return;
    await base44.entities.RecurringOverride.create({
      recurring_event_id: viewRecurring.id,
      original_date: viewRecurring.originalDate,
      new_date: moveDate,
    });
    setViewRecurring(null);
    setMoveDate("");
    await loadRecurring();
  };

  const handleShotafPlugaChange = async () => {
    if (!viewShotafTask) return;
    const dStr = toDateStr(viewShotafTask.date);
    let routine = routines.find((r) => toDateStr(new Date(r.routine_date)) === dStr);
    if (!routine) {
      routine = await base44.entities.DailyRoutine.create({
        routine_date: dStr,
        morning_assembly_plugas: [],
        frisa_morning: "טרם הוחלט",
        noon_cleaning: "טרם הוחלט",
        evening_cleaning: "טרם הוחלט",
      });
    }
    const value = shotafPluga || "טרם הוחלט";
    await base44.entities.DailyRoutine.update(routine.id, {
      [viewShotafTask.field]: value,
    });
    setViewShotafTask(null);
    setShotafPluga("");
    await loadRoutines();
  };

  const handleOverrideDelete = async (overrideId) => {
    await base44.entities.RecurringOverride.delete(overrideId);
    setViewRecurring(null);
    await loadRecurring();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
            <CalendarRange className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">אילוצי פלוגות</h1>
            <p className="text-xs text-muted-foreground">{viewMode === "day" ? "לוח זמנים יומי" : "לוח זמנים שבועי"}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => {
            setEditing(null);
            setForm({ plugas: [], constraint_date: toDateStr(new Date()), start_time: "08:00", end_time: "10:00", title: "", details: "" });
            setFormOpen(true);
          }} className="gap-2">
            <Plus className="w-4 h-4" />
            הוסף אילוץ
          </Button>
          <Button onClick={() => { setEventEditing(null); setEventFormOpen(true); }} variant="outline" className="gap-2 bg-slate-200 border-slate-400 text-slate-900 hover:bg-slate-300">
            <Plus className="w-4 h-4" />
            הוסף אירוע
          </Button>
          <Button onClick={() => setRecurringManageOpen(true)} variant="outline" className="gap-2">
            <Repeat className="w-4 h-4" />
            אירועים קבועים
          </Button>
          <Button onClick={() => setConfirmationsOverviewOpen(true)} variant="outline" className="gap-2">
            <ClipboardCheck className="w-4 h-4" />
            מעקב אישורי הגעה
          </Button>
        </div>
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
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            <Button
              variant={viewMode === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("day")}
              className="h-7"
            >
              יומי
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              className="h-7"
            >
              שבועי
            </Button>
          </div>
          <p className="text-sm font-medium">
            {viewMode === "day"
              ? `${days[0].getDate()}/${days[0].getMonth() + 1}`
              : `${days[0].getDate()}/${days[0].getMonth() + 1} - ${days[6].getDate()}/${days[6].getMonth() + 1}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm">
          <div className={cn("w-4 h-4 rounded", EVENT_COLORS.bg)} />
          <span>אירוע</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className={cn("w-4 h-4 rounded border-2 border-dashed", EVENT_COLORS.bg)} />
          <span>אירוע קבוע</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className={cn("w-4 h-4 rounded border-2 border-dotted", EVENT_COLORS.bg)} />
          <span>שוטף</span>
        </div>
        {PLUGOT.map((p) => (
          <div key={p} className="flex items-center gap-2 text-sm">
            <div className={cn("w-4 h-4 rounded", PLUGA_COLORS[p].bg)} />
            <span>{p}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-border">
          <div className={viewMode === "day" ? "" : "min-w-[700px]"}>
            <div className="flex border-b border-border bg-slate-50">
              <div className="w-14 shrink-0"></div>
              {days.map((d, i) => {
                const isToday = toDateStr(d) === toDateStr(new Date());
                return (
                  <div key={i} className={cn("flex-1 text-center py-2 border-l border-border last:border-l-0", isToday && "bg-slate-200/60")}>
                    <p className="text-sm font-medium">{DAY_NAMES[d.getDay()]}</p>
                    <p className="text-xs text-muted-foreground">{d.getDate()}/{d.getMonth() + 1}</p>
                  </div>
                );
              })}
            </div>
            <div className="flex">
              <div className="w-14 shrink-0">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="text-xs text-muted-foreground text-center pt-1 border-b border-border/50"
                    style={{ height: HOUR_HEIGHT }}
                  >
                    {h}:00
                  </div>
                ))}
              </div>
              {days.map((d, i) => {
                const dateStr = toDateStr(d);
                const dayConstraints = constraints.filter(
                  (c) => getDateOnly(c.constraint_date) === dateStr
                );
                const dayEvents = events.filter(
                  (e) => getDateOnly(e.event_date) === dateStr
                );
                const isToday = dateStr === toDateStr(new Date());

                const allBlocks = [];
                dayConstraints.forEach((c) => {
                  const top = timeToPx(c.start_time);
                  const isCrossMidnight = c.end_time < c.start_time;
                  const height = isCrossMidnight ? Math.max(totalHeight - top, 40) : Math.max(timeToPx(c.end_time) - top, 20);
                  allBlocks.push({ id: `c-${c.id}`, type: "constraint", data: c, top, height });
                });
                dayEvents.forEach((e) => {
                  const top = timeToPx(e.start_time);
                  const isCrossMidnight = e.end_time < e.start_time;
                  const height = isCrossMidnight ? Math.max(totalHeight - top, 40) : Math.max(timeToPx(e.end_time) - top, 20);
                  allBlocks.push({ id: `e-${e.id}`, type: "event", data: e, top, height });
                });
                getRecurringForDate(d).forEach((re) => {
                  const top = timeToPx(re.start_time);
                  const isCrossMidnight = re.end_time < re.start_time;
                  const height = isCrossMidnight ? Math.max(totalHeight - top, 40) : Math.max(timeToPx(re.end_time) - top, 20);
                  allBlocks.push({ id: `re-${re.id}-${re.originalDate}`, type: "recurring", data: re, top, height });
                });
                Object.entries(SHOTAF_FIELD_LABELS).forEach(([field, label]) => {
                  const timeConfig = getShotafTime(field, d);
                  if (!timeConfig) return;
                  const top = timeToPx(timeConfig.start);
                  const height = Math.max(timeToPx(timeConfig.end) - top, 20);
                  const routine = routines.find((r) => toDateStr(new Date(r.routine_date)) === toDateStr(d));
                  const routinePluga = routine?.[field];
                  allBlocks.push({ id: `shotaf-${field}-${i}`, type: "shotaf", data: { field, label, timeConfig, routinePluga }, top, height });
                });

                const layout = computeLayout(allBlocks);

                return (
                  <div
                    key={i}
                    className={cn("flex-1 relative border-l border-border last:border-l-0", isToday && "bg-slate-100/40")}
                    style={{ height: totalHeight }}
                  >
                    {hours.map((h, hi) => (
                      <div
                        key={hi}
                        className="absolute w-full border-b border-border/30"
                        style={{ top: hi * HOUR_HEIGHT }}
                      />
                    ))}
                    {allBlocks.map((block) => {
                      const { column, totalColumns } = layout.get(block.id) || { column: 0, totalColumns: 1 };
                      const w = 100 / totalColumns;
                      const blockStyle = {
                        top: block.top,
                        height: block.height,
                        right: `calc(${column * w}% + 1px)`,
                        width: `calc(${w}% - 2px)`,
                      };

                      if (block.type === "constraint") {
                        const c = block.data;
                        const plugas = c.plugas || (c.pluga ? [c.pluga] : []);
                        const colors = PLUGA_COLORS[plugas[0]] || PLUGA_COLORS[PLUGOT[0]];
                        const isMulti = plugas.length > 1;
                        return (
                          <div
                            key={block.id}
                            onClick={() => setViewConstraint(c)}
                            className={cn(
                              "absolute rounded-md p-1.5 text-xs overflow-hidden shadow-sm cursor-pointer hover:opacity-90 transition-opacity",
                              isMulti ? "bg-slate-700 text-white" : cn(colors.bg, colors.text)
                            )}
                            style={blockStyle}
                          >
                            <div className="flex items-center gap-1">
                              {plugas.map((p) => (
                                <span key={p} className={cn("w-2 h-2 rounded-full", PLUGA_COLORS[p]?.dot)} />
                              ))}
                              <p className="opacity-75 text-[10px] font-medium">{plugas.join(", ")}</p>
                            </div>
                            <p className="font-semibold truncate">{c.title}</p>
                            <p className="opacity-80 text-[10px]">{c.start_time} - {c.end_time}</p>
                            {block.height > 60 && c.details && (
                              <p className="opacity-70 mt-1 line-clamp-2">{c.details}</p>
                            )}
                          </div>
                        );
                      }

                      if (block.type === "event") {
                        const e = block.data;
                        return (
                          <div
                            key={block.id}
                            onClick={() => setViewEvent(e)}
                            className={cn(
                              "absolute rounded-md p-1.5 text-xs overflow-hidden shadow-sm cursor-pointer hover:opacity-90 transition-opacity",
                              EVENT_COLORS.bg,
                              EVENT_COLORS.text
                            )}
                            style={blockStyle}
                          >
                            <p className="opacity-75 text-[10px] font-medium">{e.event_type}</p>
                            <p className="font-semibold truncate">{e.title}</p>
                            <p className="opacity-80 text-[10px]">{e.start_time} - {e.end_time}</p>
                          </div>
                        );
                      }

                      if (block.type === "recurring") {
                        const re = block.data;
                        const colors = re.pluga ? PLUGA_COLORS[re.pluga] : EVENT_COLORS;
                        return (
                          <div
                            key={block.id}
                            onClick={() => { setViewRecurring(re); setMoveDate(""); }}
                            className={cn(
                              "absolute rounded-md p-1.5 text-xs overflow-hidden shadow-sm cursor-pointer hover:opacity-90 transition-opacity border-2 border-dashed",
                              colors.bg,
                              colors.text
                            )}
                            style={blockStyle}
                          >
                            <p className="opacity-75 text-[10px] font-medium flex items-center gap-1">
                              <Repeat className="w-2.5 h-2.5" />
                              {re.isOverride ? "הוזז" : "קבוע"}
                            </p>
                            <p className="font-semibold truncate">{re.title}</p>
                            <p className="opacity-80 text-[10px]">{re.start_time} - {re.end_time}</p>
                          </div>
                        );
                      }

                      if (block.type === "shotaf") {
                        const { field, label, timeConfig, routinePluga } = block.data;
                        const isUnassigned = !routinePluga || routinePluga === "טרם הוחלט" || (Array.isArray(routinePluga) && routinePluga.length === 0);
                        const colors = isUnassigned ? EVENT_COLORS : (PLUGA_COLORS[Array.isArray(routinePluga) ? routinePluga[0] : routinePluga] || EVENT_COLORS);
                        return (
                          <div
                            key={block.id}
                            onClick={() => {
                              if (Array.isArray(routinePluga)) return;
                              setViewShotafTask({ field, label, date: d, pluga: routinePluga });
                              setShotafPluga(routinePluga && routinePluga !== "טרם הוחלט" ? routinePluga : "");
                            }}
                            className={cn(
                              "absolute rounded-md p-1.5 text-xs overflow-hidden shadow-sm cursor-pointer hover:opacity-90 transition-opacity border-2 border-dotted",
                              colors.bg,
                              colors.text
                            )}
                            style={blockStyle}
                          >
                            <p className="opacity-75 text-[10px] font-medium">שוטף</p>
                            <p className="font-semibold truncate">{label}</p>
                            <p className="opacity-80 text-[10px]">{timeConfig.start} - {timeConfig.end}</p>
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
        <DialogContent className="sm:max-w-[480px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? "עריכת אילוץ" : "הוספת אילוץ"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>פלוגות אחראיות * (ניתן לבחור כמה)</Label>
              <div className="flex flex-wrap gap-2">
                {PLUGOT.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleFormPluga(p)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5",
                      form.plugas.includes(p)
                        ? cn(PLUGA_COLORS[p]?.bg, PLUGA_COLORS[p]?.text, "border-transparent")
                        : "bg-white text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full", !form.plugas.includes(p) && PLUGA_COLORS[p]?.dot)} />
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>תאריך *</Label>
              <Input
                type="date"
                value={form.constraint_date}
                onChange={(e) => setForm({ ...form, constraint_date: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>שעת התחלה *</Label>
                <TimeInput
                  value={form.start_time}
                  onChange={(v) => setForm({ ...form, start_time: v })}
                />
              </div>
              <div className="space-y-2">
                <Label>שעת סיום *</Label>
                <TimeInput
                  value={form.end_time}
                  onChange={(v) => setForm({ ...form, end_time: v })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>כותרת *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="כותרת האילוץ (יופיע בלוח הזמנים)"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>פירוט</Label>
              <Textarea
                value={form.details}
                onChange={(e) => setForm({ ...form, details: e.target.value })}
                placeholder="פירוט נוסף (אופציונלי)"
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
                ביטול
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "שומר..." : editing ? "שמור שינויים" : "הוסף אילוץ"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewConstraint} onOpenChange={(o) => !o && setViewConstraint(null)}>
        <DialogContent className="sm:max-w-[420px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>פרטי אילוץ</DialogTitle>
          </DialogHeader>
          {viewConstraint && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {(viewConstraint.plugas || (viewConstraint.pluga ? [viewConstraint.pluga] : [])).map((p) => (
                  <div key={p} className="flex items-center gap-1.5">
                    <div className={cn("w-3 h-3 rounded-full", (PLUGA_COLORS[p] || {}).dot)} />
                    <span className="font-medium text-sm">{p}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">כותרת</p>
                <p className="font-semibold text-lg">{viewConstraint.title}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">תאריך</p>
                <p className="text-sm">{formatHebrewDate(viewConstraint.constraint_date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">שעות</p>
                <p className="text-sm">{viewConstraint.start_time} - {viewConstraint.end_time}</p>
              </div>
              {viewConstraint.details && (
                <div>
                  <p className="text-xs text-muted-foreground">פירוט</p>
                  <p className="text-sm whitespace-pre-wrap">{viewConstraint.details}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewConstraint(null)}>סגור</Button>
            <Button
              variant="secondary"
              onClick={() => viewConstraint && openEdit(viewConstraint)}
            >
              עריכה
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (viewConstraint) {
                  handleDelete(viewConstraint.id);
                  setViewConstraint(null);
                }
              }}
            >
              מחק אילוץ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewEvent} onOpenChange={(o) => !o && setViewEvent(null)}>
        <DialogContent className="sm:max-w-[420px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>פרטי אירוע</DialogTitle>
          </DialogHeader>
          {viewEvent && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={cn("px-2 py-0.5 rounded-full text-xs font-medium", EVENT_COLORS.bg, EVENT_COLORS.text)}>
                  {viewEvent.event_type === "חיצוני" ? "אירוע חיצוני" : "אירוע פנימי"}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">כותרת</p>
                <p className="font-semibold text-lg">{viewEvent.title}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">תאריך</p>
                <p className="text-sm">{formatHebrewDate(viewEvent.event_date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">שעות</p>
                <p className="text-sm">{viewEvent.start_time} - {viewEvent.end_time}</p>
              </div>
              {viewEvent.details && (
                <div>
                  <p className="text-xs text-muted-foreground">פירוט</p>
                  <p className="text-sm whitespace-pre-wrap">{viewEvent.details}</p>
                </div>
              )}
              {viewEvent.event_type === "חיצוני" && (
                <>
                  <div className="border-t pt-3 space-y-1">
                    <p className="text-xs font-semibold text-slate-700">הסעים</p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">פלוגה: </span>
                      {viewEvent.transport_pluga || "טרם הוחלט"}
                    </p>
                    {viewEvent.transport_details && (
                      <p className="text-sm text-muted-foreground">{viewEvent.transport_details}</p>
                    )}
                  </div>
                  <div className="border-t pt-3 space-y-1">
                    <p className="text-xs font-semibold text-slate-700">אוכל</p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">פלוגה: </span>
                      {viewEvent.food_pluga || "טרם הוחלט"}
                    </p>
                    {viewEvent.food_details && (
                      <p className="text-sm text-muted-foreground">{viewEvent.food_details}</p>
                    )}
                  </div>
                </>
              )}
              {viewEvent.event_type === "פנימי" && (
                <div className="border-t pt-3 space-y-1">
                  <p className="text-xs font-semibold text-slate-700 mb-2">פלוגות אחראיות</p>
                  {viewEvent.responsible_plugas && viewEvent.responsible_plugas.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {viewEvent.responsible_plugas.map((p) => (
                        <span key={p} className={cn("text-xs px-2 py-1 rounded-full", PLUGA_COLORS[p]?.light || "bg-muted")}>
                          {p}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">טרם הוחלט</p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewEvent(null)}>סגור</Button>
            <Button variant="secondary" onClick={() => viewEvent && openEventEdit(viewEvent)}>עריכה</Button>
            <Button variant="destructive" onClick={() => viewEvent && handleEventDelete(viewEvent.id)}>מחק אירוע</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RecurringManageDialog
        open={recurringManageOpen}
        onClose={() => setRecurringManageOpen(false)}
        recurringEvents={recurringEvents}
        onRefresh={loadRecurring}
      />

      <Dialog open={!!viewRecurring} onOpenChange={(o) => !o && setViewRecurring(null)}>
        <DialogContent className="sm:max-w-[420px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>פרטי אירוע קבוע</DialogTitle>
          </DialogHeader>
          {viewRecurring && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={cn("px-2 py-0.5 rounded-full text-xs font-medium border-2 border-dashed",
                  (viewRecurring.pluga ? PLUGA_COLORS[viewRecurring.pluga] : EVENT_COLORS).bg,
                  (viewRecurring.pluga ? PLUGA_COLORS[viewRecurring.pluga] : EVENT_COLORS).text
                )}>
                  {viewRecurring.isOverride ? "הוזז חד פעמי" : "אירוע קבוע"}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">כותרת</p>
                <p className="font-semibold text-lg">{viewRecurring.title}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">שעות</p>
                <p className="text-sm">{viewRecurring.start_time} - {viewRecurring.end_time}</p>
              </div>
              {viewRecurring.pluga && (
                <div>
                  <p className="text-xs text-muted-foreground">פלוגה</p>
                  <p className="text-sm">{viewRecurring.pluga}</p>
                </div>
              )}
              {viewRecurring.details && (
                <div>
                  <p className="text-xs text-muted-foreground">פירוט</p>
                  <p className="text-sm whitespace-pre-wrap">{viewRecurring.details}</p>
                </div>
              )}
              {!viewRecurring.isOverride && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">הזזת אירוע חד פעמית</p>
                  <p className="text-xs text-muted-foreground">תאריך מקורי: {viewRecurring.originalDate}</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={moveDate}
                      onChange={(e) => setMoveDate(e.target.value)}
                    />
                    <Button size="sm" onClick={handleRecurringMove} disabled={!moveDate}>
                      הזז לתאריך
                    </Button>
                  </div>
                </div>
              )}
              {viewRecurring.isOverride && viewRecurring.overrideId && (
                <div className="border-t pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOverrideDelete(viewRecurring.overrideId)}
                  >
                    בטל הזזה - החזר למקור
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewRecurring(null)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewShotafTask} onOpenChange={(o) => !o && setViewShotafTask(null)}>
        <DialogContent className="sm:max-w-[400px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>שינוי פלוגה לשוטף</DialogTitle>
          </DialogHeader>
          {viewShotafTask && (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">משימה</p>
                <p className="font-semibold">{viewShotafTask.label}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">תאריך</p>
                <p className="text-sm">{formatHebrewDate(viewShotafTask.date)}</p>
              </div>
              <div className="space-y-2">
                <Label>פלוגה אחראית</Label>
                <Select value={shotafPluga || "טרם הוחלט"} onValueChange={(v) => setShotafPluga(v === "טרם הוחלט" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="טרם הוחלט">טרם הוחלט</SelectItem>
                    {PLUGOT.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewShotafTask(null)}>ביטול</Button>
            <Button onClick={handleShotafPlugaChange}>שמור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EventForm
        open={eventFormOpen}
        onClose={() => setEventFormOpen(false)}
        onSubmit={handleEventSubmit}
        editing={eventEditing}
      />

      <EventConfirmationsOverview
        open={confirmationsOverviewOpen}
        onClose={() => setConfirmationsOverviewOpen(false)}
        events={events}
      />
    </div>
  );
}