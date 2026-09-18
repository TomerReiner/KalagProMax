import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TimeInput from "@/components/TimeInput";
import { PLUGOT, toDateStr } from "@/lib/constants";
import { cn } from "@/lib/utils";

const emptyForm = {
  event_type: "חיצוני",
  event_date: "",
  start_time: "08:00",
  end_time: "10:00",
  title: "",
  details: "",
  transport_pluga: "",
  transport_details: "",
  food_pluga: "",
  food_details: "",
  responsible_plugas: [],
};

export default function EventForm({ open, onClose, onSubmit, editing }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          ...emptyForm,
          ...editing,
          responsible_plugas: editing.responsible_plugas || [],
        });
      } else {
        setForm({ ...emptyForm, event_date: toDateStr(new Date()) });
      }
    }
  }, [open, editing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.event_date) return;
    setSaving(true);
    try {
      await onSubmit(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const togglePluga = (p) => {
    setForm((prev) => ({
      ...prev,
      responsible_plugas: prev.responsible_plugas.includes(p)
        ? prev.responsible_plugas.filter((x) => x !== p)
        : [...prev.responsible_plugas, p],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "עריכת אירוע" : "הוספת אירוע"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, event_type: "חיצוני" })}
              className={cn(
                "flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors",
                form.event_type === "חיצוני"
                  ? "bg-slate-300 text-slate-900 border-slate-400"
                  : "bg-white text-muted-foreground border-border"
              )}
            >
              אירוע חיצוני
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, event_type: "פנימי" })}
              className={cn(
                "flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors",
                form.event_type === "פנימי"
                  ? "bg-slate-300 text-slate-900 border-slate-400"
                  : "bg-white text-muted-foreground border-border"
              )}
            >
              אירוע פנימי
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>תאריך *</Label>
              <Input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>כותרת *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="כותרת האירוע"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>שעת התחלה *</Label>
              <TimeInput
                value={form.start_time}
                onChange={(v) => setForm({ ...form, start_time: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>שעת סיום *</Label>
              <TimeInput
                value={form.end_time}
                onChange={(v) => setForm({ ...form, end_time: v })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>פירוט</Label>
            <Textarea
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              placeholder="פרטים נוספים (אופציונלי)"
              rows={2}
            />
          </div>

          {form.event_type === "חיצוני" && (
            <>
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-semibold text-slate-700">הסעים</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>פלוגה אחראית</Label>
                    <Select
                      value={form.transport_pluga || "none"}
                      onValueChange={(v) => setForm({ ...form, transport_pluga: v === "none" ? "" : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="טרם הוחלט" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">טרם הוחלט</SelectItem>
                        {PLUGOT.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>פרטים נוספים</Label>
                    <Input
                      value={form.transport_details}
                      onChange={(e) => setForm({ ...form, transport_details: e.target.value })}
                      placeholder="פרטי הסעים"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700">אוכל</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>פלוגה אחראית</Label>
                    <Select
                      value={form.food_pluga || "none"}
                      onValueChange={(v) => setForm({ ...form, food_pluga: v === "none" ? "" : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="טרם הוחלט" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">טרם הוחלט</SelectItem>
                        {PLUGOT.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>פרטים נוספים</Label>
                    <Input
                      value={form.food_details}
                      onChange={(e) => setForm({ ...form, food_details: e.target.value })}
                      placeholder="פרטי אוכל"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {form.event_type === "פנימי" && (
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">פלוגות אחראיות</p>
              <div className="flex flex-wrap gap-2">
                {PLUGOT.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePluga(p)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border transition-colors",
                      form.responsible_plugas.includes(p)
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              ביטול
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "שומר..." : editing ? "שמור שינויים" : "הוסף אירוע"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}