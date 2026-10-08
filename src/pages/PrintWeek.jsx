import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, ChevronRight, ChevronLeft } from "lucide-react";
import { PLUGA_COLORS, toDateStr } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { addDays, dateOnly, shotafSlotsForDay, eventRoles, recurringForDate, SHOTAF_FIELDS, parseDateStr } from "@/lib/battalion";
import { planningWeekStart } from "@/lib/shotafPlanner";

// "לוח שבועי להדפסה" — the week's שוטף duties and events as one clean A4
// landscape table for the notice board. The app chrome (header, nav,
// banners) is hidden in print via `print:hidden` in AppLayout. ?start= picks
// the week (Sunday); default is the current planning week.
const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const FIELD_LABELS = { morning_assembly_plugas: "מסדר בוקר", frisa_morning: "פינת פריסה", noon_cleaning: "ניקוי צהריים", evening_cleaning: "ניקוי ערב" };

export default function PrintWeek() {
  const [searchParams, setSearchParams] = useSearchParams();
  const start = parseDateStr(searchParams.get("start")) || planningWeekStart(new Date());
  const startStr = toDateStr(start);
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    const s = toDateStr(start);
    const e = toDateStr(addDays(start, 6));
    const safe = (p) => p.catch(() => []);
    Promise.all([
      safe(base44.entities.DailyRoutine.filter({ routine_date: { gte: s, lte: e } })),
      safe(base44.entities.Event.filter({ event_date: { gte: s, lte: e } })),
      safe(base44.entities.RecurringEvent.list("-created_date", 300)),
      safe(base44.entities.RecurringOverride.list("-created_date", 500)),
    ]).then(([routines, events, recurring, overrides]) => setData({ routines, events, recurring, overrides }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startStr]);

  const shift = (weeks) => setSearchParams({ start: toDateStr(addDays(start, weeks * 7)) }, { replace: true });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const end = days[6];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 print:p-0 print:max-w-none">
      <style>{"@media print { @page { size: A4 landscape; margin: 10mm; } body { background: white !important; } }"}</style>

      <div className="flex items-center justify-between gap-2 mb-4 print:hidden flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm text-muted-foreground">בחירת שבוע</span>
        </div>
        <Button onClick={() => window.print()} className="gap-2" disabled={!data}>
          <Printer className="w-4 h-4" /> הדפסה
        </Button>
      </div>

      <div className="bg-white border rounded-xl p-5 print:border-0 print:rounded-none print:p-0">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black">לוח שבועי — שוטף ואירועים</h1>
            <p className="text-sm text-slate-600">
              {start.getDate()}.{start.getMonth() + 1} – {end.getDate()}.{end.getMonth() + 1}.{end.getFullYear()}
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            {Object.entries(PLUGA_COLORS).map(([p, c]) => (
              <span key={p} className={cn("text-xs px-2 py-0.5 rounded-full font-semibold print:border", c.bg, c.text)}>{p}</span>
            ))}
          </div>
        </div>

        {!data ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-muted-foreground" /></div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-900 text-white print:bg-slate-900">
                <th className="border border-slate-300 px-2 py-1.5 text-right w-24">יום</th>
                {SHOTAF_FIELDS.map((f) => (
                  <th key={f} className="border border-slate-300 px-2 py-1.5 text-right">{FIELD_LABELS[f]}</th>
                ))}
                <th className="border border-slate-300 px-2 py-1.5 text-right w-[34%]">אירועים</th>
              </tr>
            </thead>
            <tbody>
              {days.map((date) => {
                const ds = toDateStr(date);
                const routine = data.routines.find((r) => dateOnly(r.routine_date) === ds);
                const slots = shotafSlotsForDay(routine, date);
                const events = [
                  ...data.events.filter((e) => dateOnly(e.event_date) === ds).map((e) => ({ id: e.id, time: e.start_time, title: e.title, roles: eventRoles(e) })),
                  ...recurringForDate(date, data.recurring, data.overrides).map((r) => ({ id: `r${r.id}`, time: r.start_time, title: r.title, roles: r.pluga ? [{ role: "", pluga: r.pluga }] : [] })),
                ].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
                const weekend = slots.length === 0;
                return (
                  <tr key={ds} className={cn("align-top", weekend && "bg-slate-50")}>
                    <td className="border border-slate-300 px-2 py-1.5">
                      <p className="font-bold">{DAY_NAMES[date.getDay()]}</p>
                      <p className="text-xs text-slate-500">{date.getDate()}.{date.getMonth() + 1}</p>
                    </td>
                    {SHOTAF_FIELDS.map((f) => {
                      const slot = slots.find((s) => s.field === f);
                      return (
                        <td key={f} className="border border-slate-300 px-2 py-1.5">
                          {!slot ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : slot.plugot.length ? (
                            <div className="space-y-1">
                              <div className="flex gap-1 flex-wrap">
                                {slot.plugot.map((p) => (
                                  <span key={p} className={cn("text-xs px-1.5 py-0.5 rounded font-semibold print:border", PLUGA_COLORS[p]?.bg, PLUGA_COLORS[p]?.text)}>{p}</span>
                                ))}
                              </div>
                              <p className="text-[10px] text-slate-500" dir="ltr" style={{ textAlign: "right" }}>{slot.time.start}–{slot.time.end}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-red-600 font-medium">טרם נקבע</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border border-slate-300 px-2 py-1.5">
                      {events.length === 0 ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {events.map((e) => (
                            <li key={e.id} className="text-xs">
                              <span className="font-semibold tabular-nums">{e.time}</span> {e.title}
                              {e.roles.length > 0 && (
                                <span className="text-slate-500"> — {e.roles.map((r) => `${r.role ? `${r.role}: ` : ""}${r.pluga || "טרם נקבע"}`).join(", ")}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="text-[10px] text-slate-400 mt-3">הופק מ-Binder Done That · {new Date().toLocaleString("he-IL")}</p>
      </div>
    </div>
  );
}
