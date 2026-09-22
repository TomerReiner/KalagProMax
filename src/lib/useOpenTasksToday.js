import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { toDateStr } from "@/lib/constants";

// Counts how many of a pluga's tasks for a given date (defaults to today) are
// still open. Mirrors the task set Klaf.jsx builds for a real (non-admin-preview)
// klaf: tasks not yet assigned to any pluga ("טרם הוחלט") are never counted here,
// since they aren't actionable by a specific pluga yet.
//
// Used to drive the in-app "open tasks" reminder (nav badge + banner) — no
// server-side push, just a live client-side count that re-fetches whenever the
// underlying data changes.
export function useOpenTasksToday(pluga, dateStr) {
  const [openCount, setOpenCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const effectiveDate = dateStr || toDateStr(new Date());

  const load = useCallback(async () => {
    if (!pluga) {
      setOpenCount(0);
      setLoaded(true);
      return;
    }
    try {
      const [routineData, eventData, completionData, directTaskData] = await Promise.all([
        base44.entities.DailyRoutine.filter({ routine_date: effectiveDate }),
        base44.entities.Event.filter({ event_date: effectiveDate }),
        base44.entities.TaskCompletion.filter({ task_date: effectiveDate }),
        base44.entities.DirectTask.filter({ task_date: effectiveDate }),
      ]);
      const routine = routineData[0] || null;

      const relevantTasks = [];
      if (routine) {
        if (routine.frisa_morning === pluga) relevantTasks.push({ id: routine.id, field: "frisa_morning" });
        if (routine.morning_assembly_plugas?.includes(pluga)) relevantTasks.push({ id: routine.id, field: "morning_assembly_plugas" });
        if (routine.noon_cleaning === pluga) relevantTasks.push({ id: routine.id, field: "noon_cleaning" });
        if (routine.evening_cleaning === pluga) relevantTasks.push({ id: routine.id, field: "evening_cleaning" });
      }
      eventData.forEach((e) => {
        if (e.event_type === "פנימי" && e.responsible_plugas?.includes(pluga)) {
          relevantTasks.push({ id: e.id, field: "responsible" });
        }
        if (e.event_type === "חיצוני") {
          if (e.transport_pluga === pluga) relevantTasks.push({ id: e.id, field: "transport" });
          if (e.food_pluga === pluga) relevantTasks.push({ id: e.id, field: "food" });
        }
      });
      directTaskData
        .filter((dt) => dt.pluga === pluga || dt.responsible_plugas?.includes(pluga))
        .forEach((dt) => relevantTasks.push({ id: dt.id, field: dt.id }));

      const completedKeys = new Set(completionData.map((c) => `${c.task_id}_${c.task_field}`));
      const openTasks = relevantTasks.filter((t) => !completedKeys.has(`${t.id}_${t.field}`));
      setOpenCount(openTasks.length);
    } catch {
      setOpenCount(0);
    } finally {
      setLoaded(true);
    }
  }, [pluga, effectiveDate]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the count live: refresh whenever anything it depends on changes.
  useEffect(() => {
    if (!pluga) return;
    const unsubs = [
      base44.entities.TaskCompletion.subscribe(load),
      base44.entities.DirectTask.subscribe(load),
      base44.entities.Event.subscribe(load),
      base44.entities.DailyRoutine.subscribe(load),
    ];
    return () => unsubs.forEach((u) => u());
  }, [pluga, load]);

  return { openCount, loaded };
}
