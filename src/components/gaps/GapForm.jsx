import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PLUGOT, LOCATIONS, PLUGA_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import AttachmentUploader from "@/components/gaps/AttachmentUploader";

const STATUSES = ["טרם הועלה", "בטיפול", "טופל"];
const PRIORITIES = ["נמוך", "בינוני", "גבוה", "קריטי"];
const HOUSING_LOCATIONS = ["מגורים כללי", "מגורי בנים", "מגורי בנות", "כניסה למגורי בנים", "כניסה למגורי בנות"];

export default function GapForm({ open, onClose, onSubmit, editing }) {
  const [form, setForm] = useState({
    company: "",
    gap: "",
    location: "",
    class_name: "",
    building_number: "",
    room_number: "",
    status: "טרם הועלה",
    priority: "בינוני",
    note: "",
    reporter_name: "",
    reporter_phone: "",
    attachments: [],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        company: editing.company || "",
        gap: editing.gap || "",
        location: editing.location || "",
        class_name: editing.class_name || "",
        building_number: editing.building_number || "",
        room_number: editing.room_number || "",
        status: editing.status || "טרם הועלה",
        priority: editing.priority || "בינוני",
        note: editing.note || "",
        reporter_name: editing.reporter_name || "",
        reporter_phone: editing.reporter_phone || "",
        attachments: editing.attachments || [],
      });
    } else {
      setForm({
        company: "",
        gap: "",
        location: "",
        class_name: "",
        building_number: "",
        room_number: "",
        status: "טרם הועלה",
        priority: "בינוני",
        note: "",
        reporter_name: "",
        reporter_phone: "",
        attachments: [],
      });
    }
  }, [editing, open]);

  const isHousing = HOUSING_LOCATIONS.includes(form.location);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company || !form.gap.trim()) return;
    if (form.location === "כיתות" && !form.class_name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "עריכת פער" : "הוספת פער חדש"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>פלוגה *</Label>
            <Select value={form.company} onValueChange={(v) => setForm({ ...form, company: v })}>
              <SelectTrigger><SelectValue placeholder="בחר פלוגה" /></SelectTrigger>
              <SelectContent>
                {PLUGOT.map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className="flex items-center gap-2">
                      <span className={cn("w-3 h-3 rounded-full", PLUGA_COLORS[p]?.dot)} />
                      {p}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>תיאור הפער *</Label>
            <Textarea
              value={form.gap}
              onChange={(e) => setForm({ ...form, gap: e.target.value })}
              placeholder="תיאור הליקוי או המשימה"
              required
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>מיקום</Label>
              <Select value={form.location} onValueChange={(v) => setForm({ ...form, location: v, ...(v !== "כיתות" && { class_name: "" }) })}>
                <SelectTrigger><SelectValue placeholder="בחר מיקום" /></SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>סטטוס</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.location === "כיתות" && (
            <div className="space-y-2">
              <Label>כיתה *</Label>
              <Input
                value={form.class_name}
                onChange={(e) => setForm({ ...form, class_name: e.target.value })}
                placeholder={`לדוגמה: כיתה י"א, חדר 204...`}
              />
            </div>
          )}
          {isHousing && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>מספר מבנה</Label>
                <Input
                  value={form.building_number}
                  onChange={(e) => setForm({ ...form, building_number: e.target.value })}
                  placeholder="לדוגמה: 3"
                />
              </div>
              <div className="space-y-2">
                <Label>מספר חדר</Label>
                <Input
                  value={form.room_number}
                  onChange={(e) => setForm({ ...form, room_number: e.target.value })}
                  placeholder="לדוגמה: 12"
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>עדיפות חשיבות</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">פרטי איש קשר של פותח הפער</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>שם</Label>
                <Input
                  value={form.reporter_name}
                  onChange={(e) => setForm({ ...form, reporter_name: e.target.value })}
                  placeholder="שם מלא"
                />
              </div>
              <div className="space-y-2">
                <Label>טלפון</Label>
                <Input
                  value={form.reporter_phone}
                  onChange={(e) => setForm({ ...form, reporter_phone: e.target.value })}
                  placeholder="מספר טלפון"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>הערות</Label>
            <Textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="הערות נוספות"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>קבצים מצורפים</Label>
            <AttachmentUploader
              value={form.attachments}
              onChange={(next) => setForm({ ...form, attachments: next })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              ביטול
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "שומר..." : editing ? "שמור שינויים" : "הוסף פער"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}