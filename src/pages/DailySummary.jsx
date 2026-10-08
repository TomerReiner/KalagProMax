import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, ClipboardList, FileText, Copy, Pencil, CalendarDays } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LOCATIONS, PLUGOT, PLUGA_COLORS, formatHebrewDate, toDateStr } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { usePreviewRole } from "@/lib/previewRoleContext";
import { hasPermission, effectivePermissions } from "@/lib/permissions";
import ShotafPanel from "@/components/dailysummary/ShotafPanel";

function parseEntries(entries) {
  if (!entries) return [];
  if (Array.isArray(entries)) return entries;
  if (typeof entries === "string") {
    try { return JSON.parse(entries); } catch { return []; }
  }
  return [];
}

// An entry's areas — either the current `areas` array (several גזרות under
// one responsible pluga) or, for an entry saved before that existed, the
// old singular `area` string wrapped in a one-item array. Kept in sync
// manually with the identical helper in src/components/klaf/KlafSummary.jsx
// (same DailySummary entity/entries shape, two separate screens onto it —
// see that file for why there's no shared module for it yet).
function entryAreas(e) {
  if (Array.isArray(e.areas)) return e.areas;
  if (e.area) return [e.area];
  return [];
}

// "סיכום מסדר" + "שוטף" merged into one tabbed page (feature request).
// סיכום מסדר stays fully open — anyone who can reach this tab can create
// AND edit a summary. שוטף (src/components/dailysummary/ShotafPanel.jsx,
// formerly its own admin-only page, src/pages/Shotaf.jsx) is now viewable by
// everyone here too, but only editable by whoever holds the new
// shotaf_schedule permission (or is admin) — see src/lib/permissions.js.
export default function DailySummaryPage() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  // Whether the open builder dialog is editing an existing summary
  // (pre-filled from it, saved via update()) or starting a fresh one (saved
  // via create()) — feature request: "לאפשר לעדכן סיכומי מסדר". Previously
  // a summary could only ever be created, never revisited.
  const [editingSummary, setEditingSummary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [newAreas, setNewAreas] = useState([]);
  const [newPluga, setNewPluga] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [user, setUser] = useState(null);
  const [myPermissions, setMyPermissions] = useState([]);
  const { previewRole } = usePreviewRole();
  // ?tab=shotaf[&date=YYYY-MM-DD] — links from "המשימות שלי" / "משימות"
  // land directly on the שוטף tab (on that task's day) instead of the
  // default סיכום מסדר tab.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "shotaf" ? "shotaf" : "summary";
  const initialShotafDate = searchParams.get("date");
  const setActiveTab = (tab) => {
    setSearchParams(tab === "shotaf" ? { tab: "shotaf" } : {}, { replace: true });
  };

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) { setMyPermissions([]); return; }
    base44.entities.UserPermission.filter({ user_id: user.id }).then(setMyPermissions).catch(() => setMyPermissions([]));
  }, [user?.id]);

  const effectiveRole = previewRole || user?.role;
  // previewRole-aware — see the doc comment on effectivePermissions in
  // src/lib/permissions.js (a true role preview should reflect a plain
  // member of that role, not always the real signed-in admin's full access).
  const delegatedPermissions = effectivePermissions(myPermissions, effectiveRole);
  const canEditShotaf = effectiveRole === "admin" || hasPermission(delegatedPermissions, "shotaf_schedule");

  const handleCopy = async (summary) => {
    const parsed = parseEntries(summary.entries);
    const dateStr = formatHebrewDate(summary.summary_date);
    let text = `סיכום מסדר - ${dateStr}\n\n`;
    parsed.forEach((e) => {
      const header = entryAreas(e).join(", ") + (e.pluga ? ` (${e.pluga})` : "");
      text += `${header}:\n`;
      if (e.notes) text += `${e.notes}\n`;
      text += `\n`;
    });
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "הועתק ללוח", duration: 2000 });
    } catch (err) {
      toast({ title: "שגיאה בהעתקה", variant: "destructive" });
    }
  };

  const loadSummaries = useCallback(async () => {
    try {
      const data = await base44.entities.DailySummary.list("-summary_date", 100);
      setSummaries(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

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

  const removeEntry = (idx) => {
    setEntries(entries.filter((_, i) => i !== idx));
  };

  const openCreate = () => {
    setEditingSummary(null);
    setEntries([]);
    setBuilderOpen(true);
  };

  const openEdit = (summary) => {
    setEditingSummary(summary);
    setEntries(parseEntries(summary.entries));
    setBuilderOpen(true);
  };

  const handleFinish = async () => {
    if (entries.length === 0) return;
    setSaving(true);
    try {
      if (editingSummary) {
        await base44.entities.DailySummary.update(editingSummary.id, { entries });
      } else {
        await base44.entities.DailySummary.create({
          summary_date: toDateStr(new Date()),
          entries: entries,
        });
      }
      setEntries([]);
      setEditingSummary(null);
      setBuilderOpen(false);
      await loadSummaries();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
          <ClipboardList className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold">שוטף</h1>
          <p className="text-xs text-muted-foreground">סיכומי מסדר יומיים ושיבוץ המשימות השוטפות</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList>
          <TabsTrigger value="summary" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            סיכום מסדר
          </TabsTrigger>
          <TabsTrigger value="shotaf" className="gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            שוטף
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6 pt-4">
          <div className="flex justify-end">
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              סיכום חדש
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : summaries.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-lg font-medium">אין סיכומי מסדר</p>
              <p className="text-sm mt-1">לחץ "סיכום חדש" ליצירת סיכום.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {summaries.map((s) => {
                const parsed = parseEntries(s.entries);
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-border p-5">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <h2 className="text-base font-semibold">{formatHebrewDate(s.summary_date)}</h2>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => openEdit(s)} className="gap-1.5">
                          <Pencil className="w-3.5 h-3.5" />
                          ערוך
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCopy(s)} className="gap-1.5">
                          <Copy className="w-3.5 h-3.5" />
                          העתק
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {parsed.map((e, i) => (
                        <div key={i} className="flex gap-3 text-sm border-r-2 border-slate-200 pr-3">
                          <div className="font-medium min-w-[140px] flex flex-wrap items-center gap-1.5">
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
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shotaf" className="pt-4">
          <ShotafPanel editable={canEditShotaf} initialDate={initialShotafDate} initialPlan={searchParams.get("plan") === "1"} />
        </TabsContent>
      </Tabs>

      <Dialog open={builderOpen} onOpenChange={(o) => !o && setBuilderOpen(false)}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingSummary ? `עריכת סיכום מסדר - ${formatHebrewDate(editingSummary.summary_date)}` : `סיכום מסדר - ${formatHebrewDate(toDateStr(new Date()))}`}
            </DialogTitle>
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
                <Textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="הערות לגזרות אלו"
                  rows={2}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addEntry}
                disabled={newAreas.length === 0}
                className="gap-2 w-full"
              >
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
                      {e.notes && (
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{e.notes}</p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeEntry(i)}
                      className="h-8 w-8 text-destructive shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setBuilderOpen(false); setEntries([]); setEditingSummary(null); }}
              disabled={saving}
            >
              ביטול
            </Button>
            <Button
              type="button"
              onClick={handleFinish}
              disabled={saving || entries.length === 0}
            >
              {saving ? "שומר..." : "סיום ושמירה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
