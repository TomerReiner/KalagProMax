import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function KlafConstraints({ pluga, dateStr }) {
  const [constraints, setConstraints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", start_time: "", end_time: "", details: "" });
  const { toast } = useToast();

  const loadConstraints = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Constraint.filter({ pluga, constraint_date: dateStr });
      data.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
      setConstraints(data);
    } finally {
      setLoading(false);
    }
  }, [pluga, dateStr]);

  useEffect(() => {
    loadConstraints();
  }, [loadConstraints]);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.start_time || !form.end_time) return;
    setSaving(true);
    try {
      await base44.entities.Constraint.create({
        pluga,
        constraint_date: dateStr,
        title: form.title,
        start_time: form.start_time,
        end_time: form.end_time,
        details: form.details,
      });
      setForm({ title: "", start_time: "", end_time: "", details: "" });
      setFormOpen(false);
      await loadConstraints();
      toast({ title: "אילוץ נוסף", duration: 2000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">אילוצים</h2>
          {constraints.length > 0 && (
            <span className="text-xs text-muted-foreground">({constraints.length})</span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setFormOpen(true)} className="gap-1">
          <Plus className="w-3.5 h-3.5" />
          הוסף
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : constraints.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">אין אילוצים לתאריך זה</p>
      ) : (
        <div className="space-y-2">
          {constraints.map((c) => (
            <div key={c.id} className="border-r-2 border-slate-200 pr-3 py-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{c.title}</p>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{c.start_time} - {c.end_time}</span>
              </div>
              {c.details && <p className="text-xs text-muted-foreground mt-0.5">{c.details}</p>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
        <DialogContent className="sm:max-w-[450px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>אילוץ חדש - {pluga}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>כותרת</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="כותרת האילוץ" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>שעת התחלה</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>שעת סיום</Label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>פירוט</Label>
              <Textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder="פרטים נוספים" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>ביטול</Button>
            <Button onClick={handleSubmit} disabled={saving || !form.title.trim() || !form.start_time || !form.end_time}>
              {saving ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}