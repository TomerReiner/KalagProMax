import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLUGOT } from "@/lib/constants";
import TimeInput from "@/components/TimeInput";

const RECURRENCE_OPTIONS = [
  { value: "daily", label: "כל יום" },
  { value: "sunday", label: "כל יום ראשון" },
  { value: "monday", label: "כל יום שני" },
  { value: "tuesday", label: "כל יום שלישי" },
  { value: "wednesday", label: "כל יום רביעי" },
  { value: "thursday", label: "כל יום חמישי" },
  { value: "friday", label: "כל יום שישי" },
  { value: "saturday", label: "כל יום שבת" },
];

export default function RecurringEventForm({ open, onClose, onSubmit, editing }) {
  const [form, setForm] = useState({
    title: "",
    start_time: "",
    end_time: "",
    recurrence: "daily",
    pluga: "",
    details: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          title: editing.title || "",
          start_time: editing.start_time || "",
          end_time: editing.end_time || "",
          recurrence: editing.recurrence || "daily",
          pluga: editing.pluga || "",
          details: editing.details || "",
        });
      } else {
        setForm({ title: "", start_time: "", end_time: "", recurrence: "daily", pluga: "", details: "" });
      }
    }
  }, [open, editing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.start_time || !form.end_time || !form.recurrence) return;
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.pluga) delete payload.pluga;
      if (!payload.details) delete payload.details;
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
          <DialogTitle>{editing ? "עריכת אירוע קבוע" : "הוספת אירוע קבוע"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>כותרת *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="כותרת האירוע הקבוע"
              required
            />
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
            <Label>חזרתיות *</Label>
            <Select value={form.recurrence} onValueChange={(v) => setForm({ ...form, recurrence: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECURRENCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>פלוגה (אופציונלי)</Label>
            <Select value={form.pluga} onValueChange={(v) => setForm({ ...form, pluga: v })}>
              <SelectTrigger><SelectValue placeholder="ללא פלוגה" /></SelectTrigger>
              <SelectContent>
                {PLUGOT.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>פירוט</Label>
            <Textarea
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              placeholder="פירוט נוסף (אופציונלי)"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              ביטול
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "שומר..." : editing ? "שמור שינויים" : "הוסף אירוע קבוע"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}