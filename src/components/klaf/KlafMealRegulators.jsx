import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Users2, Plus, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const MEAL_TYPES = ["צהריים", "ערב"];

// Klaf page section for the meal_regulators delegated permission (see
// src/lib/permissions.js) — 2-3 named regulators per pluga, per meal, per
// day. `pluga` and `dateStr` come from the page it's embedded in (the
// viewed pluga / selected day) rather than owning its own pickers, so it
// stays in sync with whatever day the rest of the Klaf page is showing.
export default function KlafMealRegulators({ pluga, dateStr }) {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState({ "צהריים": "", "ערב": "" });

  const load = useCallback(async () => {
    if (!pluga || !dateStr) return;
    setLoading(true);
    try {
      const data = await base44.entities.MealRegulator.filter({ pluga, meal_date: dateStr });
      setRows(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [pluga, dateStr]);

  useEffect(() => { load(); }, [load]);

  const rowFor = (mealType) => rows.find((r) => r.meal_type === mealType) || null;

  const saveNames = async (mealType, names) => {
    try {
      const existing = rowFor(mealType);
      if (existing) {
        await base44.entities.MealRegulator.update(existing.id, { names });
      } else {
        await base44.entities.MealRegulator.create({ pluga, meal_date: dateStr, meal_type: mealType, names });
      }
      await load();
    } catch (err) {
      toast({ title: "שגיאה בשמירה", description: err.message, variant: "destructive" });
    }
  };

  const addName = (mealType) => {
    const name = (newName[mealType] || "").trim();
    if (!name) return;
    const current = rowFor(mealType)?.names || [];
    saveNames(mealType, [...current, name]);
    setNewName((n) => ({ ...n, [mealType]: "" }));
  };

  const removeName = (mealType, idx) => {
    const current = rowFor(mealType)?.names || [];
    saveNames(mealType, current.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Users2 className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-semibold text-muted-foreground">מווסתים</h2>
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {MEAL_TYPES.map((mealType) => {
            const names = rowFor(mealType)?.names || [];
            return (
              <div key={mealType} className="border rounded-xl p-3 bg-white space-y-2">
                <p className="text-sm font-medium">{mealType}</p>
                <div className="space-y-1.5">
                  {names.length === 0 && <p className="text-xs text-muted-foreground">לא נקבעו מווסתים</p>}
                  {names.map((n, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-slate-50 rounded px-2 py-1">
                      <span>{n}</span>
                      <button onClick={() => removeName(mealType, i)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <Input
                    placeholder="שם"
                    value={newName[mealType]}
                    onChange={(e) => setNewName((n) => ({ ...n, [mealType]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") addName(mealType); }}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="outline" onClick={() => addName(mealType)} className="shrink-0">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
