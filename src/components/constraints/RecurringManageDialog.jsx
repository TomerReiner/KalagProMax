import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, Plus, Repeat, CalendarClock } from "lucide-react";
import { PLUGA_COLORS, toDateStr } from "@/lib/constants";
import { cn } from "@/lib/utils";
import RecurringEventForm from "@/components/constraints/RecurringEventForm";

const RECURRENCE_LABELS = {
  daily: "כל יום",
  sunday: "כל ראשון",
  monday: "כל שני",
  tuesday: "כל שלישי",
  wednesday: "כל רביעי",
  thursday: "כל חמישי",
  friday: "כל שישי",
  saturday: "כל שבת",
};

export default function RecurringManageDialog({ open, onClose, recurringEvents, onRefresh, onAdd, onEdit }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await base44.entities.RecurringEvent.delete(deleting.id);
      setDeleting(null);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (formData) => {
    if (editing) {
      await base44.entities.RecurringEvent.update(editing.id, formData);
      setEditing(null);
    } else {
      await base44.entities.RecurringEvent.create(formData);
    }
    await onRefresh();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="w-5 h-5" />
            אירועים קבועים
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {recurringEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              אין אירועים קבועים עדיין
            </p>
          ) : (
            recurringEvents.map((re) => {
              const colors = re.pluga ? PLUGA_COLORS[re.pluga] : null;
              return (
                <div
                  key={re.id}
                  className={cn(
                    "rounded-lg border p-3 flex items-center justify-between gap-2",
                    colors ? `${colors.light} ${colors.border}` : "bg-slate-50 border-slate-200"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{re.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {re.start_time} - {re.end_time} · {RECURRENCE_LABELS[re.recurrence] || re.recurrence}
                      {re.pluga ? ` · ${re.pluga}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setEditing(re); setFormOpen(true); }}
                    >
                      <CalendarClock className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => setDeleting(re)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          variant="outline"
          className="w-full gap-2"
        >
          <Plus className="w-4 h-4" />
          הוסף אירוע קבוע
        </Button>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>סגור</Button>
        </DialogFooter>

        <RecurringEventForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
          editing={editing}
        />

        <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
          <DialogContent className="sm:max-w-[400px]" dir="rtl">
            <DialogHeader>
              <DialogTitle>מחיקת אירוע קבוע</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              האם למחוק את "{deleting?.title}"? האירוע יוסר מכל הימים.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)}>ביטול</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "מחק"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}