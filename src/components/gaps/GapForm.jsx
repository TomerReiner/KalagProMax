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

// Words worth comparing (Hebrew has lots of short function words). Common
// one-letter prefixes (\u05D4/\u05D5/\u05D1/\u05DC/\u05DE/\u05DB/\u05E9) are stripped so "\u05D4\u05D1\u05E8\u05D6" matches "\u05D1\u05E8\u05D6".
const PREFIXES = "\u05D4\u05D5\u05D1\u05DC\u05DE\u05DB\u05E9";
function keywords(text) {
  return new Set(
    String(text || "")
      .replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, " ")
      .split(/\s+/)
      .map((w) => (w.length >= 4 && PREFIXES.includes(w[0]) ? w.slice(1) : w))
      .filter((w) => w.length >= 3)
  );
}

// Open gaps that look like the one being reported: same location, or at
// least two shared keywords in the description. Lets the reporter jump to
// the existing gap (and comment on it) instead of filing a duplicate.
export function findSimilarGaps(form, gaps = []) {
  const words = keywords(form.gap);
  if (!form.location && words.size === 0) return [];
  return gaps
    .filter((g) => g.status !== "טופל")
    .map((g) => {
      const shared = [...keywords(g.gap)].filter((w) => words.has(w)).length;
      const sameLocation = form.location && g.location === form.location;
      const score = (sameLocation ? 2 : 0) + shared;
      return { g, score, sameLocation, shared };
    })
    .filter((x) => x.shared >= 2 || (x.sameLocation && (x.shared >= 1 || words.size === 0)))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.g);
}

export default function GapForm({ open, onClose, onSubmit, editing, existingGaps = [], onOpenExisting }) {
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
  const similar = editing ? [] : findSimilarGaps(form, existingGaps);

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
          {similar.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 space-y-1.5">
              <p className="text-xs font-semibold text-amber-900">אולי כבר דיווחו על זה? פערים פתוחים דומים:</p>
              {similar.map((g) => (
                <div key={g.id} className="flex items-center gap-2 text-xs bg-white rounded-md px-2 py-1.5">
                  <span className="flex-1 min-w-0 truncate">{g.gap}</span>
                  <span className="text-muted-foreground shrink-0">{g.company} · {g.location} · {g.status}</span>
                  {onOpenExisting && (
                    <button type="button" onClick={() => onOpenExisting(g)} className="text-blue-600 hover:underline shrink-0">
                      פתח
                    </button>
                  )}
                </div>
              ))}
              <p className="text-[11px] text-amber-800">אם זה אותו פער — עדיף לפתוח אותו ולהוסיף תגובה. אם לא, אפשר להמשיך כרגיל.</p>
            </div>
          )}
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