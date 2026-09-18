import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Sun, Sunset, Moon, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLUGOT, PLUGA_COLORS, SHOTAF_OPTIONS, formatHebrewDate, toDateStr, getShotafTime } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function Shotaf() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const selectedDateStr = toDateStr(selectedDate);
  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  const loadRoutine = useCallback(async () => {
    try {
      const data = await base44.entities.DailyRoutine.filter({ routine_date: selectedDateStr });
      if (data.length > 0) {
        setRoutine(data[0]);
      } else {
        setRoutine(null);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedDateStr]);

  useEffect(() => {
    loadRoutine();
  }, [loadRoutine]);

  const updateField = async (field, value) => {
    setSaving(field);
    try {
      if (!routine) {
        const created = await base44.entities.DailyRoutine.create({
          routine_date: selectedDateStr,
          frisa_morning: "טרם הוחלט",
          noon_cleaning: "טרם הוחלט",
          evening_cleaning: "טרם הוחלט",
          morning_assembly_plugas: [],
          [field]: value,
        });
        setRoutine(created);
      } else {
        const updated = await base44.entities.DailyRoutine.update(routine.id, { [field]: value });
        setRoutine(updated);
      }
    } finally {
      setSaving(null);
    }
  };

  const goPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
    setLoading(true);
    setRoutine(null);
  };

  const goNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
    setLoading(true);
    setRoutine(null);
  };

  const goToday = () => {
    setSelectedDate(new Date());
    setLoading(true);
    setRoutine(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const timeStr = (field) => {
    const t = getShotafTime(field, selectedDate);
    return t ? `${t.start} - ${t.end}` : null;
  };

  const panels = [
    { field: "frisa_morning", label: "משיכת פינת פריסה", icon: Sun },
    { field: "noon_cleaning", label: "ניקוי צהריים - פינת פריסה ושירותים", icon: Sunset },
    { field: "evening_cleaning", label: "ניקוי ערב - פינת פריסה ושירותים", icon: Moon },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-1">
          <Button variant="outline" size="icon" onClick={goPrevDay}>
            <ChevronRight className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">{formatHebrewDate(selectedDate)}</h1>
          <Button variant="outline" size="icon" onClick={goNextDay}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>
        <button onClick={goToday} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          חזור להיום
        </button>
      </div>

      <div className="space-y-4">
        <div className={cn(
          "rounded-xl border-2 p-5 transition-colors",
          (routine?.morning_assembly_plugas?.length > 0)
            ? "bg-blue-50 border-blue-300"
            : "bg-slate-100 border-slate-300"
        )}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
              <Sun className="w-5 h-5 text-slate-700" />
            </div>
            <h2 className="text-base font-semibold flex-1">מסדר בוקר - פלוגות אחראיות</h2>
            <span className={cn("text-xs px-2 py-1 rounded-full whitespace-nowrap", timeStr("morning_assembly_plugas") ? "text-muted-foreground bg-white" : "text-slate-500 bg-slate-200")}>
              {timeStr("morning_assembly_plugas") || "לא פעיל (שישי/שבת)"}
            </span>
            {saving === "morning_assembly_plugas" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex flex-wrap gap-2">
            {PLUGOT.map((p) => {
              const selected = (routine?.morning_assembly_plugas || []).includes(p);
              const color = PLUGA_COLORS[p];
              return (
                <button
                  key={p}
                  onClick={() => {
                    const current = routine?.morning_assembly_plugas || [];
                    const newValue = selected
                      ? current.filter((x) => x !== p)
                      : [...current, p];
                    updateField("morning_assembly_plugas", newValue);
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all",
                    selected
                      ? `${color.bg} ${color.border} ${color.text}`
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {panels.map(({ field, label, icon: Icon }) => {
          const selectedPluga = routine?.[field] || "טרם הוחלט";
          const isUnassigned = selectedPluga === "טרם הוחלט";
          const plugaColor = !isUnassigned ? PLUGA_COLORS[selectedPluga] : null;
          return (
            <div key={field} className={cn(
              "rounded-xl border-2 p-5 transition-colors",
              plugaColor ? `${plugaColor.light} ${plugaColor.border}` : "bg-slate-100 border-slate-300"
            )}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                  <Icon className="w-5 h-5 text-slate-700" />
                </div>
                <h2 className="text-base font-semibold flex-1">{label}</h2>
                <span className={cn("text-xs px-2 py-1 rounded-full whitespace-nowrap", timeStr(field) ? "text-muted-foreground bg-white" : "text-slate-500 bg-slate-200")}>
                  {timeStr(field) || "לא פעיל (שישי/שבת)"}
                </span>
                {saving === field && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              <Select
                value={routine?.[field] || "טרם הוחלט"}
                onValueChange={(v) => updateField(field, v)}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="טרם הוחלט" />
                </SelectTrigger>
                <SelectContent>
                  {SHOTAF_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}