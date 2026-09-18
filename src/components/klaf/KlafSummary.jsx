import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Copy, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { LOCATIONS, formatHebrewDate } from "@/lib/constants";

function parseEntries(entries) {
  if (!entries) return [];
  if (Array.isArray(entries)) return entries;
  if (typeof entries === "string") {
    try { return JSON.parse(entries); } catch { return []; }
  }
  return [];
}

export default function KlafSummary({ dateStr }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [entries, setEntries] = useState([]);
  const [newArea, setNewArea] = useState("");
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
      text += `${e.area}:\n`;
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

  const addEntry = () => {
    if (!newArea.trim()) return;
    setEntries([...entries, { area: newArea, notes: newNotes }]);
    setNewArea("");
    setNewNotes("");
  };

  const handleFinish = async () => {
    if (entries.length === 0) return;
    setSaving(true);
    try {
      await base44.entities.DailySummary.create({
        summary_date: dateStr,
        entries,
      });
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
          <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1">
            <Copy className="w-3.5 h-3.5" />
            העתק
          </Button>
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
              <div className="font-medium min-w-[120px]">{e.area}</div>
              <div className="text-muted-foreground whitespace-pre-wrap">{e.notes}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-2">אין סיכום לתאריך זה</p>
          <Button size="sm" variant="outline" onClick={() => setBuilderOpen(true)} className="gap-1">
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
                <Label>איזור</Label>
                <Select value={newArea} onValueChange={setNewArea}>
                  <SelectTrigger><SelectValue placeholder="בחר איזור" /></SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>הערות</Label>
                <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="הערות לאיזור זה" rows={2} />
              </div>
              <Button type="button" variant="outline" onClick={addEntry} disabled={!newArea.trim()} className="gap-2 w-full">
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
                      <p className="text-sm font-medium">{e.area}</p>
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