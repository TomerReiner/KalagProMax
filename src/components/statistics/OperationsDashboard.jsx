import React, { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend, AreaChart, Area, CartesianGrid } from "recharts";
import { PLUGOT } from "@/lib/constants";
import { CalendarRange, CalendarDays, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const EVENT_TYPE_COLORS = { "חיצוני": "#8b5cf6", "פנימי": "#3b82f6" };
const TASK_STATUS_COLORS = { "פתוחה": "#f59e0b", "טופלה": "#22c55e" };
const PLUGA_HEX = { "פארן": "#3b82f6", "בשור": "#10b981", "צין": "#475569", "רמון": "#ef4444", "תמר": "#eab308" };

function getLast30Days() {
  const days = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    days.push({ date: `${y}-${m}-${day}`, label: `${d.getDate()}/${d.getMonth() + 1}` });
  }
  return days;
}

function ChartCard({ title, icon: Icon, iconColor, children }) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", iconColor)}>
          <Icon className="w-4 h-4" />
        </div>
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function OperationsDashboard({ events, constraints, directTasks, taskCompletions, dailyRoutines }) {
  const eventTypeData = useMemo(() => {
    const c = { "חיצוני": 0, "פנימי": 0 };
    events.forEach(e => { if (c[e.event_type] != null) c[e.event_type]++; });
    return Object.entries(c).map(([name, value]) => ({ name, value }));
  }, [events]);

  const constraintByPluga = useMemo(() => {
    return PLUGOT.map(p => ({
      name: p,
      value: constraints.filter(c => c.pluga === p).length,
    }));
  }, [constraints]);

  const taskStatusData = useMemo(() => {
    const c = { "פתוחה": 0, "טופלה": 0 };
    directTasks.forEach(t => { if (c[t.status] != null) c[t.status]++; });
    return Object.entries(c).map(([name, value]) => ({ name, value }));
  }, [directTasks]);

  const completionTimeline = useMemo(() => {
    const days = getLast30Days();
    const c = {};
    taskCompletions.forEach(tc => {
      if (!tc.created_date) return;
      const d = new Date(tc.created_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      c[key] = (c[key] || 0) + 1;
    });
    return days.map(d => ({ ...d, count: c[d.date] || 0 }));
  }, [taskCompletions]);

  const routineCoverage = useMemo(() => {
    const fields = ["morning_assembly_plugas", "frisa_morning", "noon_cleaning", "evening_cleaning"];
    const labels = { morning_assembly_plugas: "מסדר בוקר", frisa_morning: "פריסה בוקר", noon_cleaning: "ניקוי צהריים", evening_cleaning: "ניקוי ערב" };
    return fields.map(f => ({
      name: labels[f],
      assigned: dailyRoutines.filter(r => {
        if (f === "morning_assembly_plugas") return r.morning_assembly_plugas && r.morning_assembly_plugas.length > 0;
        return r[f] && r[f] !== "טרם הוחלט";
      }).length,
      unassigned: dailyRoutines.filter(r => {
        if (f === "morning_assembly_plugas") return !r.morning_assembly_plugas || r.morning_assembly_plugas.length === 0;
        return !r[f] || r[f] === "טרם הוחלט";
      }).length,
    }));
  }, [dailyRoutines]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="אירועים לפי סוג" icon={CalendarRange} iconColor="bg-purple-100 text-purple-700">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">אין אירועים</p>
          ) : (
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={eventTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                    {eventTypeData.map((e, i) => <Cell key={i} fill={EVENT_TYPE_COLORS[e.name]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
        <ChartCard title="משימות ישירות לפי סטטוס" icon={CheckSquare} iconColor="bg-amber-100 text-amber-700">
          {directTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">אין משימות ישירות</p>
          ) : (
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={taskStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                    {taskStatusData.map((e, i) => <Cell key={i} fill={TASK_STATUS_COLORS[e.name]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard title="אילוצים לפי פלוגה" icon={CalendarRange} iconColor="bg-slate-100 text-slate-700">
        {constraints.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">אין אילוצים</p>
        ) : (
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={constraintByPluga}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="אילוצים" radius={[4, 4, 0, 0]}>
                  {constraintByPluga.map((e, i) => <Cell key={i} fill={PLUGA_HEX[e.name] || "#94a3b8"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard title="ציר זמן - השלמת משימות (30 ימים)" icon={CheckSquare} iconColor="bg-emerald-100 text-emerald-700">
        {taskCompletions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">אין נתוני השלמה</p>
        ) : (
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={completionTimeline}>
                <defs>
                  <linearGradient id="colorCompletions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" name="משימות שהושלמו" stroke="#22c55e" fillOpacity={1} fill="url(#colorCompletions)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard title="כיסוי מסדרי שוטף" icon={CalendarDays} iconColor="bg-blue-100 text-blue-700">
        {dailyRoutines.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">אין נתוני שוטף</p>
        ) : (
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={routineCoverage}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="assigned" name="משויך" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="unassigned" name="לא משויך" stackId="a" fill="#e2e8f0" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </div>
  );
}