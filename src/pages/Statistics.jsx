import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, BarChart3 } from "lucide-react";
import StatCard from "@/components/statistics/StatCard";
import GapDashboard from "@/components/statistics/GapDashboard";
import OperationsDashboard from "@/components/statistics/OperationsDashboard";
import ActivityTimeline from "@/components/statistics/ActivityTimeline";

export default function Statistics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [gaps, constraints, events, directTasks, taskCompletions, dailyRoutines, dailySummaries] = await Promise.all([
          base44.entities.Gap.list("-created_date", 500),
          base44.entities.Constraint.list("-created_date", 500),
          base44.entities.Event.list("-created_date", 500),
          base44.entities.DirectTask.list("-created_date", 500),
          base44.entities.TaskCompletion.list("-created_date", 500),
          base44.entities.DailyRoutine.list("-created_date", 500),
          base44.entities.DailySummary.list("-created_date", 500),
        ]);
        setData({ gaps, constraints, events, directTasks, taskCompletions, dailyRoutines, dailySummaries });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { gaps, constraints, events, directTasks, taskCompletions, dailyRoutines } = data;
  const openGaps = gaps.filter(g => g.status !== "טופל");
  const criticalGaps = gaps.filter(g => g.priority === "קריטי" && g.status !== "טופל");
  const staleGaps = gaps.filter(g => {
    const d = Math.floor((Date.now() - new Date(g.updated_date).getTime()) / 86400000);
    return d >= 7 && g.status !== "טופל";
  });

  return (
    <>
      <header className="bg-white/80 backdrop-blur-md border-b border-border sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">סטטיסטיקה ופילוחים</h1>
            <p className="text-xs text-muted-foreground">ניתוח נתונים, מגמות וציר זמן</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="סה״כ פערים" value={gaps.length} tone="slate" />
          <StatCard label="פתוחים" value={openGaps.length} tone="amber" />
          <StatCard label="קריטיים פתוחים" value={criticalGaps.length} tone="red" />
          <StatCard label="לא עודכנו (7+ ימים)" value={staleGaps.length} tone="orange" />
          <StatCard label="אירועים" value={events.length} tone="purple" />
          <StatCard label="אילוצים" value={constraints.length} tone="blue" />
        </div>

        <GapDashboard gaps={gaps} />

        <OperationsDashboard
          events={events}
          constraints={constraints}
          directTasks={directTasks}
          taskCompletions={taskCompletions}
          dailyRoutines={dailyRoutines}
        />

        <ActivityTimeline
          gaps={gaps}
          taskCompletions={taskCompletions}
          events={events}
          directTasks={directTasks}
        />
      </main>
    </>
  );
}