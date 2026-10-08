import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, FileSpreadsheet } from "lucide-react";
import { PLUGA_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { loadWeekData, plugaWeekStats, exportWeeklyReport } from "@/lib/weeklyReport";

const MEDALS = ["🥇", "🥈", "🥉"];

// "טבלת הפלוגות — 7 ימים אחרונים". For an admin (who can see every pluga's
// task completions) plugot are ranked by % of their own tasks they actually
// marked done; otherwise it's an unranked weekly summary. Plus the
// "דוח שבועי" Excel export for reporting up the chain.
export default function PlugaLeaderboard({ isAdmin }) {
  const [week, setWeek] = useState(null);

  useEffect(() => {
    loadWeekData().then(setWeek).catch(() => setWeek(null));
  }, []);

  if (!week) {
    return (
      <div className="bg-white border rounded-xl p-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = plugaWeekStats(week, { withCompletion: isAdmin });
  const ranked = isAdmin
    ? [...stats].sort((a, b) => (b.completionRate ?? -1) - (a.completionRate ?? -1) || b.gapsClosed - a.gapsClosed)
    : stats;
  const topRate = ranked[0]?.completionRate;
  const anyProgress = isAdmin && ranked.some((s) => (s.completionRate ?? 0) > 0);

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b flex-wrap">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-bold">{isAdmin ? "טבלת הפלוגות" : "סיכום שבועי לפי פלוגה"}</h2>
          <span className="text-xs text-muted-foreground">· 7 ימים אחרונים</span>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportWeeklyReport(week, { withCompletion: isAdmin })}>
          <FileSpreadsheet className="w-4 h-4 text-emerald-700" /> דוח שבועי לאקסל
        </Button>
      </div>
      {isAdmin && !anyProgress && (
        <p className="text-xs text-muted-foreground px-4 py-2 bg-slate-50 border-b">
          עוד לא סומנו משימות כבוצעות בשבוע האחרון — הדירוג יתמלא ככל שהקל"פים יסמנו משימות ב"המשימות שלי".
        </p>
      )}
      <div className="divide-y">
        {ranked.map((s, i) => {
          const color = PLUGA_COLORS[s.pluga];
          const leader = isAdmin && i === 0 && topRate != null && topRate > 0;
          return (
            <div key={s.pluga} className={cn("flex items-center gap-3 px-4 py-2.5", leader && "bg-amber-50/60")}>
              <span className="w-6 text-center text-lg">
                {anyProgress && (s.completionRate ?? 0) > 0 && MEDALS[i] ? MEDALS[i] : isAdmin ? <span className="text-sm text-muted-foreground">{i + 1}</span> : ""}
              </span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold w-14 text-center", color.bg, color.text)}>{s.pluga}</span>
              <div className="flex-1 min-w-0">
                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={cn("h-full rounded-full", color.bg)} style={{ width: `${s.completionRate ?? 0}%` }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums w-10 text-left">{s.completionRate == null ? "—" : `${s.completionRate}%`}</span>
                  </div>
                ) : null}
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isAdmin ? `${s.completed}/${s.tasks} משימות בוצעו` : `${s.tasks} משימות`} · {s.shotaf} תורנויות שוטף · {s.gapsClosed} פערים טופלו
                  {s.overdue > 0 && <span className="text-red-600"> · {s.overdue} ציוד באיחור</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
