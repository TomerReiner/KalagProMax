import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Phone, Users2 } from "lucide-react";
import { PLUGOT, PLUGA_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { MEAL_TYPES, isRowFilled } from "@/lib/mealRegulators";

// Read-only "מווסתים להיום" — every pluga that has anything filled in for
// `dateStr` (regulators or an entry time), in PLUGOT order. Plugot with
// nothing filled are left out, and if nobody filled anything the whole
// section renders nothing at all (feature request: "אם אין בכלל לאותו יום
// הם לא רואים כלום ואם כל הפלוגות שמו הם יראו את כולם").
export default function MealRegulatorsDaySummary({ dateStr, title = "מווסתים", className }) {
  const [rows, setRows] = useState([]);

  const load = useCallback(async () => {
    if (!dateStr) return;
    try {
      setRows(await base44.entities.MealRegulator.filter({ meal_date: dateStr }));
    } catch {
      setRows([]);
    }
  }, [dateStr]);

  useEffect(() => {
    load();
    const unsubscribe = base44.entities.MealRegulator.subscribe(() => load());
    return unsubscribe;
  }, [load]);

  const filledPlugot = PLUGOT.filter((p) => rows.some((r) => r.pluga === p && isRowFilled(r)));
  if (filledPlugot.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1.5">
        <Users2 className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {filledPlugot.map((p) => {
          const color = PLUGA_COLORS[p];
          return (
            <div key={p} className={cn("rounded-xl border-2 p-3 space-y-2", color?.light, color?.border)}>
              <p className="text-sm font-bold">{p}</p>
              {MEAL_TYPES.map((mealType) => {
                const row = rows.find((r) => r.pluga === p && r.meal_type === mealType);
                if (!isRowFilled(row)) return null;
                return (
                  <div key={mealType} className="bg-white/80 rounded-lg px-2.5 py-2 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">{mealType}</span>
                      {row.entry_time && <span className="text-muted-foreground">כניסה {row.entry_time}</span>}
                    </div>
                    {(row.regulators || []).map((r, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-sm flex-wrap">
                        <span>{r.name}</span>
                        {r.phone && (
                          <a href={`tel:${r.phone}`} className="text-xs text-blue-600 flex items-center gap-1 font-medium" dir="ltr">
                            <Phone className="w-3 h-3" />
                            {r.phone}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
