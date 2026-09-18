import React, { useMemo } from "react";
import { Clock, HardHat, CheckCircle2, CalendarRange, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_CONFIG = {
  gap: { icon: HardHat, color: "bg-amber-100 text-amber-700", label: "פער חדש" },
  completion: { icon: CheckCircle2, color: "bg-emerald-100 text-emerald-700", label: "משימה הושלמה" },
  event: { icon: CalendarRange, color: "bg-purple-100 text-purple-700", label: "אירוע" },
  task: { icon: CheckSquare, color: "bg-blue-100 text-blue-700", label: "משימה ישירה" },
};

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `לפני ${days} ימים`;
  const months = Math.floor(days / 30);
  return `לפני ${months} חודשים`;
}

export default function ActivityTimeline({ gaps, taskCompletions, events, directTasks }) {
  const activities = useMemo(() => {
    const all = [
      ...gaps.map(g => ({ type: "gap", title: g.gap, date: g.created_date, meta: g.company, status: g.status })),
      ...taskCompletions.map(tc => ({ type: "completion", title: tc.task_label, date: tc.created_date, meta: tc.pluga })),
      ...events.map(e => ({ type: "event", title: e.title, date: e.created_date, meta: e.event_type })),
      ...directTasks.map(dt => ({ type: "task", title: dt.title, date: dt.created_date, meta: dt.pluga })),
    ].filter(a => a.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);
    return all;
  }, [gaps, taskCompletions, events, directTasks]);

  return (
    <div className="bg-white rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
          <Clock className="w-4 h-4" />
        </div>
        <h2 className="text-sm font-bold">ציר זמן - פעילות אחרונה</h2>
      </div>
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">אין פעילות</p>
      ) : (
        <div className="relative">
          <div className="absolute right-[15px] top-0 bottom-0 w-0.5 bg-slate-200" />
          <div className="space-y-3">
            {activities.map((a, i) => {
              const config = TYPE_CONFIG[a.type];
              const Icon = config.icon;
              return (
                <div key={i} className="relative flex gap-3 items-start">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ring-4 ring-white", config.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 pt-0.5 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{config.label}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{relativeTime(a.date)}</span>
                    </div>
                    <p className="text-sm font-medium mt-0.5 truncate">{a.title}</p>
                    {a.meta && <p className="text-xs text-muted-foreground">{a.meta}{a.status ? ` · ${a.status}` : ""}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}