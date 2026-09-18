import React, { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend, AreaChart, Area, CartesianGrid } from "recharts";
import { PLUGOT } from "@/lib/constants";
import { HardHat, Clock, TrendingUp, MapPin, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS = {
  "טרם הועלה": "#f59e0b",
  "בטיפול": "#3b82f6",
  "טופל": "#22c55e",
};

const PRIORITY_COLORS = {
  "נמוך": "#94a3b8",
  "בינוני": "#3b82f6",
  "גבוה": "#f59e0b",
  "קריטי": "#ef4444",
};

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

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

export default function GapDashboard({ gaps }) {
  const statusCounts = useMemo(() => {
    const c = { "טרם הועלה": 0, "בטיפול": 0, "טופל": 0 };
    gaps.forEach(g => { if (c[g.status] != null) c[g.status]++; });
    return c;
  }, [gaps]);

  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  const priorityData = useMemo(() => {
    const c = { "נמוך": 0, "בינוני": 0, "גבוה": 0, "קריטי": 0 };
    gaps.forEach(g => { if (c[g.priority] != null) c[g.priority]++; });
    return Object.entries(c).map(([name, value]) => ({ name, value }));
  }, [gaps]);

  const plugaData = useMemo(() => {
    return PLUGOT.map(p => {
      const pg = gaps.filter(g => g.company === p);
      return {
        name: p,
        "טרם הועלה": pg.filter(g => g.status === "טרם הועלה").length,
        "בטיפול": pg.filter(g => g.status === "בטיפול").length,
        "טופל": pg.filter(g => g.status === "טופל").length,
      };
    });
  }, [gaps]);

  const locationData = useMemo(() => {
    const c = {};
    gaps.forEach(g => { if (g.location) c[g.location] = (c[g.location] || 0) + 1; });
    return Object.entries(c).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [gaps]);

  const timelineData = useMemo(() => {
    const days = getLast30Days();
    const c = {};
    gaps.forEach(g => {
      if (!g.created_date) return;
      const d = new Date(g.created_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      c[key] = (c[key] || 0) + 1;
    });
    return days.map(d => ({ ...d, count: c[d.date] || 0 }));
  }, [gaps]);

  const oldestGaps = useMemo(() => {
    return gaps
      .filter(g => g.status !== "טופל")
      .map(g => ({
        ...g,
        age: daysSince(g.created_date) || 0,
        shortGap: g.gap && g.gap.length > 30 ? g.gap.substring(0, 30) + "..." : g.gap,
      }))
      .sort((a, b) => b.age - a.age)
      .slice(0, 10);
  }, [gaps]);

  const completionRate = gaps.length > 0 ? Math.round((statusCounts["טופל"] / gaps.length) * 100) : 0;

  const trendData = useMemo(() => {
    const now = Date.now();
    const last7 = gaps.filter(g => g.created_date && (now - new Date(g.created_date).getTime()) < 7 * 86400000).length;
    const closedLast7 = gaps.filter(g => {
      if (g.status !== "טופל" || !g.updated_date) return false;
      return (now - new Date(g.updated_date).getTime()) < 7 * 86400000;
    }).length;
    return { last7, closedLast7, netTrend: last7 - closedLast7 };
  }, [gaps]);

  return (
    <div className="space-y-4">
      {/* Status Pipeline */}
      <div className="bg-white rounded-xl border border-border p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold">התקדמות טיפול בפערים</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {["טרם הועלה", "בטיפול", "טופל"].map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex-1 min-w-[100px] text-center p-3 rounded-lg" style={{ backgroundColor: `${STATUS_COLORS[s]}15` }}>
                <p className="text-2xl font-bold" style={{ color: STATUS_COLORS[s] }}>{statusCounts[s]}</p>
                <p className="text-xs text-muted-foreground mt-1">{s}</p>
              </div>
              {i < 2 && <div className="text-slate-300 text-xl">←</div>}
            </React.Fragment>
          ))}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">אחוז השלמה</span>
            <span className="text-xs font-bold">{completionRate}%</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${completionRate}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-50 rounded-lg p-2">
            <p className="text-lg font-bold text-blue-600">{trendData.last7}</p>
            <p className="text-xs text-muted-foreground">נפתחו (7 ימים)</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-2">
            <p className="text-lg font-bold text-emerald-600">{trendData.closedLast7}</p>
            <p className="text-xs text-muted-foreground">נסגרו (7 ימים)</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-2">
            <p className={cn("text-lg font-bold", trendData.netTrend > 0 ? "text-red-600" : "text-emerald-600")}>
              {trendData.netTrend > 0 ? "+" : ""}{trendData.netTrend}
            </p>
            <p className="text-xs text-muted-foreground">מאזן נטו</p>
          </div>
        </div>
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="פילוח לפי סטטוס" icon={HardHat} iconColor="bg-amber-100 text-amber-700">
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((e, i) => <Cell key={i} fill={STATUS_COLORS[e.name]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="פילוח לפי עדיפות" icon={AlertTriangle} iconColor="bg-red-100 text-red-700">
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={priorityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                  {priorityData.map((e, i) => <Cell key={i} fill={PRIORITY_COLORS[e.name]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Pluga and Location */}
      <ChartCard title="פילוח לפי פלוגה (סטטוס)" icon={HardHat} iconColor="bg-blue-100 text-blue-700">
        <div dir="ltr">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={plugaData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="טרם הועלה" stackId="a" fill={STATUS_COLORS["טרם הועלה"]} />
              <Bar dataKey="בטיפול" stackId="a" fill={STATUS_COLORS["בטיפול"]} />
              <Bar dataKey="טופל" stackId="a" fill={STATUS_COLORS["טופל"]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="מיקומים בעייתיים (Top 8)" icon={MapPin} iconColor="bg-purple-100 text-purple-700">
        {locationData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">אין נתוני מיקום</p>
        ) : (
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={locationData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* Creation Timeline */}
      <ChartCard title="ציר זמן - פערים שהוצפו (30 ימים אחרונים)" icon={Clock} iconColor="bg-blue-100 text-blue-700">
        <div dir="ltr">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timelineData}>
              <defs>
                <linearGradient id="colorGaps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="count" name="פערים שהוצפו" stroke="#3b82f6" fillOpacity={1} fill="url(#colorGaps)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Oldest Open Gaps */}
      <ChartCard title="הפערים הפתוחים הוותיקים ביותר" icon={Clock} iconColor="bg-amber-100 text-amber-700">
        {oldestGaps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">אין פערים פתוחים 🎉</p>
        ) : (
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={oldestGaps} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis type="number" tick={{ fontSize: 10 }} unit=" ימים" allowDecimals={false} />
                <YAxis type="category" dataKey="shortGap" width={180} tick={{ fontSize: 10 }} />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload || !payload.length) return null;
                    const g = payload[0].payload;
                    return (
                      <div className="bg-white border rounded-lg p-2 shadow-md text-xs" dir="rtl">
                        <p className="font-medium">{g.gap}</p>
                        <p className="text-muted-foreground">{g.company} · {g.location}</p>
                        <p className="text-amber-600 font-bold">פתוח {g.age} ימים</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="age" name="ימים פתוח" radius={[0, 4, 4, 0]}>
                  {oldestGaps.map((g, i) => (
                    <Cell key={i} fill={PRIORITY_COLORS[g.priority] || "#f59e0b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </div>
  );
}