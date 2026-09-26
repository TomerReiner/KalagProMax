import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Users2, Plus, X, Phone } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const MEAL_TYPES = ["צהריים", "ערב"];
const EMPTY_FORM = { name: "", phone: "" };

// Klaf page section for the meal_regulators delegated permission (see
// src/lib/permissions.js) — 2-3 named regulators per pluga, per meal, per
// day, each with an optional phone number (tap-to-call). `pluga` and
// `dateStr` come from the page it's embedded in (the viewed pluga / selected
// day) rather than owning its own pickers, so it stays in sync with
// whatever day the rest of the Klaf page is showing.
export default function KlafMealRegulators({ pluga, dateStr }) {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEntry, setNewEntry] = useState({ "צהריים": EMPTY_FORM, "ערב": EMPTY_FORM });

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
  const regulatorsFor = (mealType) => rowFor(mealType)?.regulators || [];

  const saveRegulators = async (mealType, regulators) => {
    try {
      const existing = rowFor(mealType);
      if (existing) {
        await base44.entities.MealRegulator.update(existing.id, { regulators });
      } else {
        await base44.entities.MealRegulator.create({ pluga, meal_date: dateStr, meal_type: mealType, regulators });
      }
      await load();
    } catch (err) {
      toast({ title: "שגיאה בשמירה", description: err.message, variant: "destructive" });
    }
  };

  const addRegulator = (mealType) => {
    const name = (newEntry[mealType]?.name || "").trim();
    if (!name) return;
    const phone = (newEntry[mealType]?.phone || "").trim();
    const current = regulatorsFor(mealType);
    saveRegulators(mealType, [...current, { name, phone: phone || null }]);
    setNewEntry((n) => ({ ...n, [mealType]: EMPTY_FORM }));
  };

  const removeRegulator = (mealType, idx) => {
    const current = regulatorsFor(mealType);
    saveRegulators(mealType, current.filter((_, i) => i !== idx));
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
            const regulators = regulatorsFor(mealType);
            const entry = newEntry[mealType] || EMPTY_FORM;
            return (
              <div key={mealType} className="border rounded-xl p-3 bg-white space-y-2">
                <p className="text-sm font-medium">{mealType}</p>
                <div className="space-y-1.5">
                  {regulators.length === 0 && <p className="text-xs text-muted-foreground">לא נקבעו מווסתים</p>}
                  {regulators.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm bg-slate-50 rounded px-2 py-1 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{r.name}</span>
                        {r.phone && (
                          <a href={`tel:${r.phone}`} className="text-xs text-blue-600 flex items-center gap-1 font-medium">
                            <Phone className="w-3 h-3" />
                            {r.phone}
                          </a>
                        )}
                      </div>
                      <button onClick={() => removeRegulator(mealType, i)} className="text-muted-foreground hover:text-destructive shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Input
                    placeholder="שם"
                    value={entry.name}
                    onChange={(e) => setNewEntry((n) => ({ ...n, [mealType]: { ...entry, name: e.target.value } }))}
                    onKeyDown={(e) => { if (e.key === "Enter") addRegulator(mealType); }}
                    className="h-8 text-sm"
                  />
                  <div className="flex gap-1.5">
                    <Input
                      type="tel"
                      placeholder="טלפון (אופציונלי)"
                      value={entry.phone}
                      onChange={(e) => setNewEntry((n) => ({ ...n, [mealType]: { ...entry, phone: e.target.value } }))}
                      onKeyDown={(e) => { if (e.key === "Enter") addRegulator(mealType); }}
                      className="h-8 text-sm flex-1"
                    />
                    <Button size="sm" variant="outline" onClick={() => addRegulator(mealType)} className="shrink-0">
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
