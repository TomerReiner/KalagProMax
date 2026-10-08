import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Package, AlarmClock, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { daysOverdue } from "@/lib/battalion";

// "ציוד הפלוגה" on the קל"פ's own page — everything the pluga currently
// holds from the warehouses, overdue items first and in red, so the person
// actually responsible for returning it sees it every day (not only whoever
// manages the warehouses). Renders nothing when the pluga holds nothing.
export default function KlafPlugaEquipment({ pluga }) {
  const [holdings, setHoldings] = useState([]);

  const load = useCallback(async () => {
    if (!pluga) return;
    try {
      setHoldings(await base44.entities.EquipmentHolding.filter({ pluga }));
    } catch {
      setHoldings([]);
    }
  }, [pluga]);

  useEffect(() => {
    load();
    const unsubscribe = base44.entities.EquipmentHolding.subscribe(() => load());
    return unsubscribe;
  }, [load]);

  if (!holdings.length) return null;
  const rows = holdings
    .map((h) => ({ ...h, late: h.expected_return_date ? daysOverdue(h.expected_return_date) : 0 }))
    .sort((a, b) => b.late - a.late);
  const lateCount = rows.filter((h) => h.late > 0).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Package className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-semibold text-muted-foreground">ציוד שהפלוגה מחזיקה ({holdings.length})</h2>
        <Link to="/equipment?tab=holdings" className="mr-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
          למחסנים <ChevronLeft className="w-3 h-3" />
        </Link>
      </div>
      {lateCount > 0 && (
        <div className="flex items-center gap-2 text-sm bg-red-50 border border-red-200 text-red-800 rounded-xl px-3 py-2">
          <AlarmClock className="w-4 h-4 shrink-0" />
          {lateCount === 1 ? "פריט אחד באיחור בהחזרה למחסן" : `${lateCount} פריטים באיחור בהחזרה למחסן`} — כדאי להחזיר או לתאם הארכה
        </div>
      )}
      <div className="bg-white border rounded-xl divide-y">
        {rows.map((h) => (
          <div key={h.id} className="flex items-center gap-2 px-3 py-2">
            <span className="text-sm flex-1 min-w-0 truncate">
              {h.item_name} ×{h.quantity} <span className="text-xs text-muted-foreground">· {h.warehouse}</span>
            </span>
            <span
              className={cn(
                "text-[11px] px-1.5 py-0.5 rounded-full shrink-0",
                h.late > 0 ? "bg-red-600 text-white font-semibold" : h.expected_return_date ? "bg-slate-100 text-slate-600" : "bg-slate-50 text-muted-foreground"
              )}
            >
              {h.late > 0 ? `באיחור ${h.late} ימים` : h.expected_return_date ? `להחזיר עד ${h.expected_return_date}` : "ללא תאריך"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
