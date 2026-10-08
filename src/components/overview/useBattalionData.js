import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { toDateStr } from "@/lib/constants";
import { addDays } from "@/lib/battalion";

// Everything "תמונת מצב" needs, in one parallel fetch: the coming week's
// schedule (routines, events, constraints, tasks, recurring), today's
// completions and meal regulators, and the current state of every queue
// that can need someone's attention (gaps, withdrawals, Playbox, holdings,
// access requests). Any single failing call (e.g. RLS refusing a table to
// this role) just comes back empty instead of failing the whole page.
//
// Refreshes live — debounced — whenever one of the watched tables changes.
const WATCHED = ["Gap", "DailyRoutine", "Event", "TaskCompletion", "DirectTask", "WithdrawalRequest", "PlayboxOrder", "EquipmentHolding", "MealRegulator", "EventConfirmation"];

export function useBattalionData({ isAdmin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);

  const load = useCallback(async () => {
    const today = new Date();
    const startStr = toDateStr(today);
    const endStr = toDateStr(addDays(today, 6));
    const tomorrowStr = toDateStr(addDays(today, 1));
    const e = base44.entities;
    const safe = (p) => p.catch(() => []);
    const [
      routines, events, constraints, directTasks, completions, recurring, overrides, gaps, withdrawals,
      orders, holdings, items, regulators, confirmations, announcements, accessRequests, profiles,
    ] = await Promise.all([
      safe(e.DailyRoutine.filter({ routine_date: { gte: startStr, lte: endStr } })),
      safe(e.Event.filter({ event_date: { gte: startStr, lte: endStr } })),
      safe(e.Constraint.filter({ constraint_date: { gte: startStr, lte: endStr } })),
      safe(e.DirectTask.filter({ task_date: { gte: startStr, lte: endStr } })),
      safe(e.TaskCompletion.filter({ task_date: startStr })),
      safe(e.RecurringEvent.list("-created_date", 300)),
      safe(e.RecurringOverride.list("-created_date", 500)),
      safe(e.Gap.list("-created_date", 500)),
      safe(e.WithdrawalRequest.filter({ status: "pending" })),
      safe(e.PlayboxOrder.list("-order_date", 200)),
      safe(e.EquipmentHolding.list("-created_date", 500)),
      safe(e.WarehouseItem.list()),
      safe(e.MealRegulator.filter({ meal_date: { gte: startStr, lte: tomorrowStr } })),
      safe(e.EventConfirmation.list("-created_date", 500)),
      safe(e.Announcement.list("-created_date", 10)),
      isAdmin ? safe(e.AccessRequest.filter({ status: "pending" })) : Promise.resolve([]),
      safe(e.User.list()),
    ]);
    setData({
      routines, events, constraints, directTasks, completions, recurring, overrides, gaps, withdrawals,
      orders, holdings, items, regulators, confirmations, announcements, accessRequests, profiles,
      loadedAt: new Date(),
    });
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    load();
    const refresh = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 400);
    };
    const unsubs = WATCHED.map((name) => base44.entities[name]?.subscribe?.(refresh)).filter(Boolean);
    return () => {
      clearTimeout(timer.current);
      unsubs.forEach((u) => u());
    };
  }, [load]);

  return { data, loading, reload: load };
}
