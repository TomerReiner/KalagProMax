import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Copy, FileText, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { LOCATIONS, PLUGOT, PLUGA_COLORS, formatHebrewDate } from "@/lib/constants";
import { cn } from "@/lib/utils";

function parseEntries(entries) {
  if (!entries) return [];
  if (Array.isArray(entries)) return entries;
  if (typeof entries === "string") {
    try { return JSON.parse(entries); } catch { return []; }
  }
  return [];
}

// See the identical helper in src/pages/DailySummary.jsx — same
// DailySummary entity/entries shape, two separate screens onto it, kept in
// sync manually since there's no shared UI-utility module yet.
function entryAreas(e) {
  if (Array.isArray(e.areas)) return e.areas;
  if (e.area) return [e.area];
  return [];
}

export default function KlafSummary({ dateStr }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  // Whether the open builder dialog is editing the existing summary
  // (pre-filled from it, saved via update()) or starting a fresh one (saved
  // via create()) — feature request: "לאפשר לעדכן סיכומי מסדר כדי שקלפים
  // יוכלו לעדכן את הסיכום מסדר". Previously this dialog could only ever
  // create a brand-new summary; once one existed for the day there was no
  // way back into it short of editing the raw data.
  const [editing, setEditing] = useState(false);
  const [entries, setEntries] = useState([]);
  const [newAreas, setNewAreas] = useState([]);
  const [newPluga, setNewPluga] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.DailySummary.filter({ summary_date: dateStr });
      setSummary(data[0] || null);
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleCopy = async () => {
    if (!summary) return;
    const parsed = parseEntries(summary.entries);
    let text = `סיכום מסדר - ${formatHebrewDate(summary.summary_date)}\n\n`;
    parsed.forEach((e) => {
      const header = entryAreas(e).join(", ") + (e.pluga ? ` (${e.pluga})` : "");
      text += `${header}:\n`;
      if (e.notes) text += `${e.notes}\n`;
      text += `\n`;
    });
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "הועתק ללוח", duration: 2000 });
    } catch {
      toast({ title: "שגיאה בהעתקה", variant: "destructive" });
    }
  };

  const toggleArea = (area) => {
    setNewAreas((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  };

  const addEntry = () => {
    if (newAreas.length === 0) return;
    setEntries([...entries, { areas: newAreas, pluga: newPluga || null, notes: newNotes }]);
    setNewAreas([]);
    setNewPluga("");
    setNewNotes("");
  };

  const openCreate = () => {
    setEditing(false);
    setEntries([]);
    setBuilderOpen(true);
  };

  const openEdit = () => {
    if (!summary) return;
    setEditing(true);
    setEntries(parseEntries(summary.entries));
    setBuilderOpen(true);
  };

  const handleFinish = async () => {
    if (entries.length === 0) return;
    setSaving(true);
    try {
      if (editing && summary) {
        await base44.entities.DailySummary.update(summary.id, { entries });
      } else {
        await base44.entities.DailySummary.create({
          summary_date: dateStr,
          entries,
        });
      }
      setEntries([]);
      setBuilderOpen(false);
      await loadSummary();
    } finally {
      setSaving(false);
    }
  };

  const parsed = summary ? parseEntries(summary.entries) : [];

  return (
    <div className="bg-white rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">סיכום מסדר</h2>
        </div>
        {summary && (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={openEdit} className="gap-1">
              <Pencil className="w-3.5 h-3.5" />
              ערוך
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1">
              <Copy className="w-3.5 h-3.5" />
              העתק
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : summary ? (
        <div className="space-y-2">
          {parsed.map((e, i) => (
            <div key={i} className="flex gap-3 text-sm border-r-2 border-slate-200 pr-3">
              <div className="font-medium min-w-[120px] flex flex-wrap items-center gap-1.5">
                {e.pluga && (
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", PLUGA_COLORS[e.pluga]?.light)}>
                    {e.pluga}
                  </span>
                )}
                <span>{entryAreas(e).join(", ")}</span>
              </div>
              <div className="text-muted-foreground whitespace-pre-wrap">{e.notes}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-2">אין סיכום לתאריך זה</p>
          <Button size="sm" variant="outline" onClick={openCreate} className="gap-1">
            <Plus className="w-3.5 h-3.5" />
            צור סיכום
          </Button>
        </div>
      )}

      <Dialog open={builderOpen} onOpenChange={(o) => !o && setBuilderOpen(false)}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>סיכום מסדר - {formatHebrewDate(dateStr)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3 border rounded-lg p-4 bg-slate-50">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>גזרות (אפשר לבחור כמה)</Label>
                  <button
                    type="button"
                    onClick={() => setNewAreas(newAreas.length === LOCATIONS.length ? [] : [...LOCATIONS])}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {newAreas.length === LOCATIONS.length ? "נקה הכל" : "בחר הכל"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 border rounded-lg bg-white">
                  {LOCATIONS.map((l) => {
                    const selected = newAreas.includes(l);
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => toggleArea(l)}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-full border transition-colors",
                          selected ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-border"
                        )}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label>פלוגה אחראית (אופציונלי)</Label>
                <Select value={newPluga || ""} onValueChange={setNewPluga}>
                  <SelectTrigger><SelectValue placeholder="בחר פלוגה אחראית" /></SelectTrigger>
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
                <Label>הערות</Label>
                <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="הערות לגזרות אלו" rows={2} />
              </div>
              <Button type="button" variant="outline" onClick={addEntry} disabled={newAreas.length === 0} className="gap-2 w-full">
                <Plus className="w-4 h-4" />
                הוסף לסיכום
              </Button>
            </div>

            {entries.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">פריטים בסיכום ({entries.length}):</p>
                {entries.map((e, i) => (
                  <div key={i} className="flex items-start gap-3 border rounded-lg p-3 bg-white">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {e.pluga && (
                          <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", PLUGA_COLORS[e.pluga]?.light)}>
                            {e.pluga}
                          </span>
                        )}
                        <p className="text-sm font-medium">{entryAreas(e).join(", ")}</p>
                      </div>
                      {e.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{e.notes}</p>}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setEntries(entries.filter((_, idx) => idx !== i))} className="h-8 w-8 text-destructive shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setBuilderOpen(false); setEntries([]); }} disabled={saving}>ביטול</Button>
            <Button type="button" onClick={handleFinish} disabled={saving || entries.length === 0}>
              {saving ? "שומר..." : "סיום ושמירה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}