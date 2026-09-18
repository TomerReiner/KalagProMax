import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLUGOT, toDateStr } from "@/lib/constants";
import TimeInput from "@/components/TimeInput";

export default function DirectTaskForm({ open, onClose, onSubmit, defaultPluga, defaultDate }) {
  const [form, setForm] = useState({
    title: "",
    pluga: defaultPluga || "",
    task_date: defaultDate || toDateStr(new Date()),
    start_time: "",
    end_time: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        title: "",
        pluga: defaultPluga || "",
        task_date: defaultDate || toDateStr(new Date()),
        start_time: "",
        end_time: "",
        notes: "",
      });
    }
  }, [open, defaultPluga, defaultDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.pluga || !form.task_date) return;
    setSaving(true);
    try {
      const payload = { ...form, status: "פתוחה" };
      if (!payload.start_time) delete payload.start_time;
      if (!payload.end_time) delete payload.end_time;
      if (!payload.notes) delete payload.notes;
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
          <DialogTitle>הוספת משימה ישירה</DialogTitle>
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
            <Label>פלוגה מבצעת *</Label>
            <Select value={form.pluga} onValueChange={(v) => setForm({ ...form, pluga: v })}>
              <SelectTrigger><SelectValue placeholder="בחר פלוגה" /></SelectTrigger>
              <SelectContent>
                {PLUGOT.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>שעת התחלה</Label>
              <TimeInput
                value={form.start_time}
                onChange={(v) => setForm({ ...form, start_time: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>שעת סיום</Label>
              <TimeInput
                value={form.end_time}
                onChange={(v) => setForm({ ...form, end_time: v })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>הערות</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="הערות נוספות (אופציונלי)"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              ביטול
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "שומר..." : "הוסף משימה"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}