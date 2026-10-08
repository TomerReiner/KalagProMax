import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Loader2, Wand2, AlertTriangle, ChevronDown, Scale } from "lucide-react";
import { PLUGOT, PLUGA_COLORS, toDateStr } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { addDays, dateOnly } from "@/lib/battalion";
import {
  planWeek, planToWrites, planningWeekStart, typicalAssemblySize, countDuties, plugaConflicts,
} from "@/lib/shotafPlanner";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const SHORT_LABEL = {
  morning_assembly_plugas: "מסדר בוקר",
  frisa_morning: "פינת פריסה",
  noon_cleaning: "ניקוי צהריים",
  evening_cleaning: "ניקוי ערב",
};

// "שיבוץ אוטומטי לשוטף" — proposes a fair, constraint-aware assignment for a
// whole week (see src/lib/shotafPlanner.js), shows it as an editable preview
// with a fairness meter, and only writes once confirmed.
export default function ShotafPlannerDialog({ open, onClose, anchorDate, onApplied }) {
  const { toast } = useToast();
  // From Thursday on, "this week" only has today left — default to next week.
  const [weekOffset, setWeekOffset] = useState(() => (new Date().getDay() === 4 ? 1 : 0));
  const [overwrite, setOverwrite] = useState(false);
  const [assemblySize, setAssemblySize] = useState(null);
  const [source, setSource] = useState(null);
  const [plan, setPlan] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setSource(null);
    const ws = addDays(planningWeekStart(anchorDate || new Date()), weekOffset * 7);
    const wsStr = toDateStr(ws);
    const weStr = toDateStr(addDays(ws, 6));
    const histStr = toDateStr(addDays(ws, -30));
    const safe = (p) => p.catch(() => []);
    const [allRoutines, constraints, events] = await Promise.all([
      safe(base44.entities.DailyRoutine.filter({ routine_date: { gte: histStr, lte: weStr } })),
      safe(base44.entities.Constraint.filter({ constraint_date: { gte: wsStr, lte: weStr } })),
      safe(base44.entities.Event.filter({ event_date: { gte: wsStr, lte: weStr } })),
    ]);
    const history = allRoutines.filter((r) => dateOnly(r.routine_date) < wsStr);
    const routines = allRoutines.filter((r) => dateOnly(r.routine_date) >= wsStr);
    setSource({ history, routines, constraints, events, weekStart: ws });
    setAssemblySize((s) => s ?? typicalAssemblySize(history));
  }, [anchorDate, weekOffset]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!source || assemblySize == null) return;
    setPlan(planWeek({ ...source, overwrite, assemblySize }));
  }, [source, overwrite, assemblySize]);

  const setCell = (dateStr, field, plugot) => {
    setPlan((prev) => ({
      ...prev,
      days: prev.days.map((d) => {
        if (d.dateStr !== dateStr) return d;
        return {
          ...d,
          cells: d.cells.map((c) => {
            if (c.field !== field) return c;
            const conflicts = plugot.flatMap((p) =>
              plugaConflicts(p, dateStr, c.time.start, c.time.end, source).map((x) => ({ ...x, pluga: p }))
            );
            return { ...c, proposed: plugot, changed: true, conflicts };
          }),
        };
      }),
    }));
  };

  const writes = plan ? planToWrites(plan.days) : [];
  const changeCount = writes.reduce((n, w) => n + Object.keys(w.changes).length, 0);
  const conflictCount = plan ? plan.days.reduce((n, d) => n + d.cells.filter((c) => c.changed && c.conflicts.length).length, 0) : 0;

  // Fairness after applying this (possibly edited) plan: history + the
  // week as it would look.
  const fairness = plan && source
    ? countDuties([
        ...source.history,
        // days of the planned week that already passed (never re-planned)
        ...source.routines.filter((r) => dateOnly(r.routine_date) < toDateStr(new Date())),
        ...plan.days.map((d) => Object.fromEntries(d.cells.map((c) => [c.field, c.field === "morning_assembly_plugas" ? c.proposed : c.proposed[0]]))),
      ])
    : null;
  const totals = fairness ? PLUGOT.map((p) => fairness[p].total) : [];
  const maxTotal = Math.max(1, ...totals);
  const spread = totals.length ? Math.max(...totals) - Math.min(...totals) : 0;

  const apply = async () => {
    setSaving(true);
    try {
      for (const w of writes) {
        if (w.routine) {
          await base44.entities.DailyRoutine.update(w.routine.id, w.changes);
        } else {
          await base44.entities.DailyRoutine.create({
            routine_date: w.dateStr,
            morning_assembly_plugas: [],
            frisa_morning: "טרם הוחלט",
            noon_cleaning: "טרם הוחלט",
            evening_cleaning: "טרם הוחלט",
            ...w.changes,
          });
        }
      }
      toast({ title: `השיבוץ נשמר — ${changeCount} משימות שוטף שובצו`, duration: 3000 });
      onApplied?.();
      onClose();
    } catch (err) {
      toast({ title: "שגיאה בשמירת השיבוץ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const weekLabel = (offset) => {
    const ws = addDays(planningWeekStart(anchorDate || new Date()), offset * 7);
    const we = addDays(ws, 4);
    return `${ws.getDate()}.${ws.getMonth() + 1}–${we.getDate()}.${we.getMonth() + 1}`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" /> שיבוץ אוטומטי לשוטף
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-2">
          המתכנן משבץ כל משימה לפלוגה שעשתה אותה הכי מעט ב-30 הימים האחרונים, נמנע משתי משימות לאותה פלוגה באותו יום,
          ולא משבץ פלוגה שיש לה אילוץ או אירוע בשעות המשימה. אפשר לשנות כל תא לפני השמירה.
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {[0, 1].map((o) => (
              <button
                key={o}
                onClick={() => setWeekOffset(o)}
                className={cn("px-3 py-1.5 rounded-md text-sm font-medium", weekOffset === o ? "bg-white shadow-sm" : "text-muted-foreground")}
              >
                {o === 0 ? "השבוע" : "שבוע הבא"} <span className="text-xs text-muted-foreground">{weekLabel(o)}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="w-4 h-4" />
            לשבץ מחדש גם משימות שכבר משובצות
          </label>
          <label className="flex items-center gap-2 text-sm">
            מסדר בוקר:
            <select
              value={assemblySize ?? 1}
              onChange={(e) => setAssemblySize(Number(e.target.value))}
              className="border rounded-md px-2 py-1 text-sm bg-white"
            >
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n === 1 ? "פלוגה אחת" : `${n} פלוגות`}</option>)}
            </select>
          </label>
        </div>

        {!plan ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-muted-foreground" /></div>
        ) : plan.days.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">אין ימי שוטף בשבוע הזה</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plan.days.map((d) => (
              <div key={d.dateStr} className="border rounded-xl bg-white p-3 space-y-2">
                <p className="text-sm font-bold">
                  יום {DAY_NAMES[d.date.getDay()]} <span className="font-normal text-muted-foreground">{d.date.getDate()}.{d.date.getMonth() + 1}</span>
                </p>
                {d.cells.map((c) => (
                  <PlanCell key={c.field} cell={c} onChange={(plugot) => setCell(d.dateStr, c.field, plugot)} />
                ))}
              </div>
            ))}
          </div>
        )}

        {fairness && (
          <div className="border rounded-xl p-3 bg-slate-50 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Scale className="w-4 h-4" /> הוגנות — 30 יום אחרונים + השיבוץ הזה
              <span className={cn("text-xs font-normal mr-auto", spread <= 2 ? "text-emerald-700" : "text-amber-700")}>
                {spread <= 2 ? "מאוזן" : `פער של ${spread} משימות בין הפלוגות`}
              </span>
            </p>
            {PLUGOT.map((p) => (
              <div key={p} className="flex items-center gap-2 text-xs">
                <span className="w-10 font-medium">{p}</span>
                <div className="flex-1 h-2.5 rounded-full bg-white border overflow-hidden">
                  <div className={cn("h-full", PLUGA_COLORS[p].bg)} style={{ width: `${(fairness[p].total / maxTotal) * 100}%` }} />
                </div>
                <span className="w-6 text-left tabular-nums">{fairness[p].total}</span>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {conflictCount > 0 && (
            <span className="text-xs text-amber-700 flex items-center gap-1 ml-auto">
              <AlertTriangle className="w-3.5 h-3.5" /> {conflictCount} שיבוצים מתנגשים באילוץ — כדאי לבדוק
            </span>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>ביטול</Button>
          <Button onClick={apply} disabled={saving || changeCount === 0} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {changeCount === 0 ? "אין מה לשבץ" : `שמור שיבוץ (${changeCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanCell({ cell, onChange }) {
  const multi = cell.field === "morning_assembly_plugas";
  const conflict = cell.changed && cell.conflicts.length > 0;
  return (
    <div className={cn("rounded-lg px-2 py-1.5", conflict ? "bg-amber-50 border border-amber-200" : cell.changed ? "bg-emerald-50/60" : "bg-slate-50")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-600">
          {SHORT_LABEL[cell.field]} <span className="text-muted-foreground tabular-nums" dir="ltr">{cell.time.start}</span>
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 flex-wrap justify-end">
              {cell.proposed.length === 0 && <span className="text-[11px] text-red-600">טרם הוחלט</span>}
              {cell.proposed.map((p) => (
                <span key={p} className={cn("text-[11px] px-1.5 py-0.5 rounded-full font-medium", PLUGA_COLORS[p]?.bg, PLUGA_COLORS[p]?.text)}>{p}</span>
              ))}
              {!cell.changed && <span className="text-[10px] text-muted-foreground">קיים</span>}
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" dir="rtl">
            {multi
              ? PLUGOT.map((p) => (
                  <DropdownMenuCheckboxItem
                    key={p}
                    checked={cell.proposed.includes(p)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(on) => onChange(on ? [...cell.proposed, p] : cell.proposed.filter((x) => x !== p))}
                  >
                    {p}
                  </DropdownMenuCheckboxItem>
                ))
              : [...PLUGOT, null].map((p) => (
                  <DropdownMenuItem key={p || "none"} onSelect={() => onChange(p ? [p] : [])}>
                    {p ? (
                      <span className="flex items-center gap-2">
                        <span className={cn("w-2.5 h-2.5 rounded-full", PLUGA_COLORS[p].dot)} /> {p}
                      </span>
                    ) : "טרם הוחלט"}
                  </DropdownMenuItem>
                ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {conflict && (
        <p className="text-[10px] text-amber-800 mt-1 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
          {cell.conflicts.map((c) => `${c.pluga}: ${c.kind} "${c.title}" ${c.start}–${c.end}`).join(" · ")}
        </p>
      )}
    </div>
  );
}
