import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PLUGOT, PLUGA_COLORS, toDateStr } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function StandaloneTaskForm({ open, onClose, onSubmit, defaultDate }) {
  const [form, setForm] = useState({
    title: "",
    notes: "",
    responsible_plugas: [],
    task_date: defaultDate || toDateStr(new Date()),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        title: "",
        notes: "",
        responsible_plugas: [],
        task_date: defaultDate || toDateStr(new Date()),
      });
    }
  }, [open, defaultDate]);

  const togglePluga = (pluga) => {
    setForm((prev) => ({
      ...prev,
      responsible_plugas: prev.responsible_plugas.includes(pluga)
        ? prev.responsible_plugas.filter((p) => p !== pluga)
        : [...prev.responsible_plugas, pluga],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.task_date) return;
    setSaving(true);
    try {
      const payload = { ...form, status: "פתוחה" };
      if (!payload.notes) delete payload.notes;
      if (!payload.responsible_plugas?.length) delete payload.responsible_plugas;
      await onSubmit(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>משימה חדשה</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>כותרת *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="כותרת המשימה"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>תאריך *</Label>
            <Input
              type="date"
              value={form.task_date}
              onChange={(e) => setForm({ ...form, task_date: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>פלוגות אחריות (אופציונלי)</Label>
            <div className="flex flex-wrap gap-2">
              {PLUGOT.map((p) => {
                const selected = form.responsible_plugas.includes(p);
                const color = PLUGA_COLORS[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePluga(p)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                      selected
                        ? cn(color?.light, color?.border)
                        : "bg-white border-border text-muted-foreground hover:bg-slate-50"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              במידה ותשייך פלוגה, המשימה תקפוץ אוטומטית לקלף של אותה פלוגה
            </p>
          </div>
          <div className="space-y-2">
            <Label>הערות נוספות</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="הערות נוספות (אופציונלי)"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              ביטול
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "שומר..." : "צור משימה"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}