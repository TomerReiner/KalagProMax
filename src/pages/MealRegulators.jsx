import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight, ChevronLeft, Send, X, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { PLUGOT, PLUGA_COLORS, formatHebrewDate, toDateStr } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { usePreviewRole } from "@/lib/previewRoleContext";
import { effectivePermissions } from "@/lib/permissions";
import {
  MEAL_TASK_KIND, MEAL_TASK_TITLE, isMealRegulatorsManager, canEditPlugaRegulators, taskPlugot, isRowFilled,
} from "@/lib/mealRegulators";
import KlafMealRegulators from "@/components/klaf/KlafMealRegulators";
import MealRegulatorsDaySummary from "@/components/mealregulators/MealRegulatorsDaySummary";

// "מווסתים" — the whole meal-regulators page (feature request: an admin can
// make a קלפ "אחראי מווסתים", like the equipment / Playbox managers).
//
//  - The manager (meal_regulators_manager, admin automatically) sees every
//    pluga for the selected day: can fill any of them in directly, and can
//    "ask the קלפ to fill it" — that creates a task for that pluga's קלפ
//    (direct_tasks, kind = 'meal_regulators'), shown in their
//    "המשימות שלי", which also lets them edit their own pluga on that day.
//  - A קלפ with such a task (or anyone with a scoped meal_regulators grant)
//    gets an editable card for their pluga.
//  - Everyone sees a read-only summary of whatever was filled in that day —
//    nothing at all if nothing was filled.
// See src/lib/mealRegulators.js for the rules.
function parseDateStr(str) {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function MealRegulators() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(() => parseDateStr(searchParams.get("date")) || new Date());
  const dateStr = toDateStr(selectedDate);

  const [user, setUser] = useState(null);
  const [myPermissions, setMyPermissions] = useState(null);
  const { previewRole, previewPluga } = usePreviewRole();
  const [tasks, setTasks] = useState([]);
  const [rows, setRows] = useState([]);
  const [busyPluga, setBusyPluga] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    base44.entities.UserPermission.filter({ user_id: user.id }).then(setMyPermissions).catch(() => setMyPermissions([]));
  }, [user?.id]);

  const loadDay = useCallback(async () => {
    try {
      const [taskData, rowData] = await Promise.all([
        base44.entities.DirectTask.filter({ task_date: dateStr, kind: MEAL_TASK_KIND }),
        base44.entities.MealRegulator.filter({ meal_date: dateStr }),
      ]);
      setTasks(taskData);
      setRows(rowData);
    } catch {
      // ignore
    }
  }, [dateStr]);

  useEffect(() => {
    loadDay();
    const unsubTasks = base44.entities.DirectTask.subscribe(() => loadDay());
    const unsubRows = base44.entities.MealRegulator.subscribe(() => loadDay());
    return () => {
      unsubTasks?.();
      unsubRows?.();
    };
  }, [loadDay]);

  const shiftDay = (delta) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
    setSearchParams({ date: toDateStr(d) }, { replace: true });
  };
  const goToday = () => {
    setSelectedDate(new Date());
    setSearchParams({}, { replace: true });
  };

  if (!user || myPermissions === null) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const effectiveRole = previewRole || user.role;
  const userPluga = previewRole === "קלפ" ? previewPluga : user.pluga;
  const delegatedPermissions = effectivePermissions(myPermissions, effectiveRole);
  const isManager = isMealRegulatorsManager(delegatedPermissions);
  const editablePlugot = PLUGOT.filter((p) =>
    canEditPlugaRegulators({ delegatedPermissions, effectiveRole, userPluga, pluga: p, assignedTasks: tasks })
  );
  const tasksFor = (p) => tasks.filter((t) => taskPlugot(t).includes(p));
  const isFilled = (p) => rows.some((r) => r.pluga === p && isRowFilled(r));

  const assign = async (p) => {
    setBusyPluga(p);
    try {
      await base44.entities.DirectTask.create({
        title: MEAL_TASK_TITLE,
        pluga: p,
        responsible_plugas: [p],
        task_date: dateStr,
        status: "פתוחה",
        kind: MEAL_TASK_KIND,
        notes: `נשלח ע"י ${user.full_name || user.email} — למלא שמות מווסתים ושעות כניסה לצהריים ולערב`,
      });
      toast({ title: `נשלחה משימה לקל"פ ${p}`, duration: 2000 });
      await loadDay();
    } catch (err) {
      toast({ title: "שגיאה בשליחת המשימה", description: err.message, variant: "destructive" });
    } finally {
      setBusyPluga(null);
    }
  };

  const unassign = async (p) => {
    setBusyPluga(p);
    try {
      for (const t of tasksFor(p)) await base44.entities.DirectTask.delete(t.id);
      toast({ title: `הבקשה מ${p} בוטלה`, duration: 2000 });
      await loadDay();
    } catch (err) {
      toast({ title: "שגיאה בביטול", description: err.message, variant: "destructive" });
    } finally {
      setBusyPluga(null);
    }
  };

  const assignAllMissing = async () => {
    for (const p of PLUGOT) {
      if (tasksFor(p).length === 0 && !isFilled(p)) await assign(p);
    }
  };

  const unassignedMissing = PLUGOT.filter((p) => tasksFor(p).length === 0 && !isFilled(p));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-1">
          <Button variant="outline" size="icon" onClick={() => shiftDay(-1)}>
            <ChevronRight className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">{formatHebrewDate(selectedDate)}</h1>
          <Button variant="outline" size="icon" onClick={() => shiftDay(1)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>
        <button onClick={goToday} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          חזור להיום
        </button>
      </div>

      {isManager && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border bg-white p-3">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              את/ה אחראי/ת המווסתים — אפשר למלא כל פלוגה בעצמך, או לבקש מהקל"פ שלה למלא (יופיע אצלו כמשימה).
            </span>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={assignAllMissing} disabled={unassignedMissing.length === 0 || !!busyPluga}>
            <Send className="w-3.5 h-3.5" />
            בקש מכל הפלוגות שעוד לא מילאו{unassignedMissing.length > 0 ? ` (${unassignedMissing.length})` : ""}
          </Button>
        </div>
      )}

      {editablePlugot.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {editablePlugot.map((p) => {
            const color = PLUGA_COLORS[p];
            const assigned = tasksFor(p).length > 0;
            const filled = isFilled(p);
            return (
              <div key={p} className={cn("rounded-xl border-2 p-3 space-y-3", color?.light, color?.border)}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-base font-bold">{p}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {filled ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> מולא
                      </span>
                    ) : assigned ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> ממתין למילוי ע"י הקל"פ
                      </span>
                    ) : null}
                    {isManager && (
                      assigned ? (
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={busyPluga === p} onClick={() => unassign(p)}>
                          <X className="w-3.5 h-3.5" /> בטל בקשה מהקל"פ
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs bg-white" disabled={busyPluga === p} onClick={() => assign(p)}>
                          {busyPluga === p ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          בקש מהקל"פ למלא
                        </Button>
                      )
                    )}
                  </div>
                </div>
                {!isManager && assigned && (
                  <p className="text-xs text-slate-700 bg-white/70 rounded-lg px-2.5 py-1.5">
                    אחראי המווסתים ביקש ממך למלא את המווסתים ושעות הכניסה של {p} ליום הזה.
                  </p>
                )}
                <KlafMealRegulators pluga={p} dateStr={dateStr} hideTitle onChange={loadDay} />
              </div>
            );
          })}
        </div>
      )}

      {/* Read-only view of every pluga that filled something in — for a
          manager it would just repeat the cards above, so it's skipped. */}
      {!isManager && (
        <MealRegulatorsDaySummary
          dateStr={dateStr}
          title={editablePlugot.length > 0 ? "מווסתים שמולאו היום (כל הפלוגות)" : "מווסתים"}
        />
      )}

      {!isManager && editablePlugot.length === 0 && !rows.some(isRowFilled) && (
        <p className="text-center text-sm text-muted-foreground py-10">עוד לא נקבעו מווסתים ליום הזה</p>
      )}
    </div>
  );
}
