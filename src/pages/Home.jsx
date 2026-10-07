import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, HardHat, Download, LayoutGrid, List } from "lucide-react";
import * as XLSX from "xlsx";
import GapCard, { PRIORITY_RANK, daysSince } from "@/components/gaps/GapCard";
import GapBoard from "@/components/gaps/GapBoard";
import GapForm from "@/components/gaps/GapForm";
import GapFilters from "@/components/gaps/GapFilters";
import GapDetail from "@/components/gaps/GapDetail";
import { PLUGOT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Home() {
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState([]);
  const [priorityFilters, setPriorityFilters] = useState([]);
  const [companyFilter, setCompanyFilter] = useState("all");
  const [sort, setSort] = useState("priority");
  const [staleOnly, setStaleOnly] = useState(false);
  const [staleDays, setStaleDays] = useState(7);
  const [archiveView, setArchiveView] = useState("active");
  // "board" = Jira-style columns by status (the new default); "list" = the
  // original card-list view, kept as an alternative.
  const [layoutMode, setLayoutMode] = useState("board");
  const [detailGap, setDetailGap] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const loadGaps = useCallback(async () => {
    try {
      const data = await base44.entities.Gap.list("-created_date", 500);
      setGaps(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGaps();
    const unsubscribe = base44.entities.Gap.subscribe(() => {
      loadGaps();
    });
    return unsubscribe;
  }, [loadGaps]);

  const companies = PLUGOT;

  const filtered = useMemo(() => {
    let list = gaps.filter((g) => {
      // The active/archive split only applies to the list view. The board
      // shows every status as its own column at once (that's the point of a
      // kanban board — "טופל" is just the rightmost/last column, not hidden
      // away), so applying it there would just make the "טופל" column look
      // permanently empty for no reason.
      if (layoutMode === "list") {
        if (archiveView === "active" && g.status === "טופל") return false;
        if (archiveView === "archive" && g.status !== "טופל") return false;
      }
      if (statusFilters.length > 0 && !statusFilters.includes(g.status)) return false;
      if (priorityFilters.length > 0 && !priorityFilters.includes(g.priority)) return false;
      if (companyFilter !== "all" && g.company !== companyFilter) return false;
      if (staleOnly) {
        const d = daysSince(g.updated_date);
        if (d == null || d < staleDays || g.status === "טופל") return false;
      }
      if (search.trim()) {
        const q = search.trim();
        const hay = `${g.gap || ""} ${g.location || ""} ${g.company || ""} ${g.note || ""}`;
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "priority":
          return (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
        case "stale": {
          const da = daysSince(a.updated_date) ?? 0;
          const db = daysSince(b.updated_date) ?? 0;
          return db - da;
        }
        case "newest":
          return new Date(b.created_date) - new Date(a.created_date);
        case "oldest":
          return new Date(a.created_date) - new Date(b.created_date);
        default:
          return 0;
      }
    });
    return list;
  }, [gaps, statusFilters, priorityFilters, companyFilter, staleOnly, staleDays, search, sort, layoutMode, archiveView]);

  const stats = useMemo(() => {
    const byStatus = { "טרם הועלה": 0, "בטיפול": 0, "טופל": 0 };
    gaps.forEach((g) => {
      if (byStatus[g.status] != null) byStatus[g.status] += 1;
    });
    const staleCount = gaps.filter((g) => {
      const d = daysSince(g.updated_date);
      return d != null && d >= staleDays && g.status !== "טופל";
    }).length;
    return { ...byStatus, total: gaps.length, stale: staleCount };
  }, [gaps, staleDays]);

  const handleSubmit = async (form) => {
    if (editing) {
      const updates = {};
      const changeLogs = [];
      if (editing.status !== form.status) {
        updates.status = form.status;
        changeLogs.push({ update_type: "שינוי סטטוס", field: "סטטוס", old_value: editing.status, new_value: form.status, text: `הסטטוס שונה מ-${editing.status} ל-${form.status}` });
      }
      if (editing.priority !== form.priority) {
        updates.priority = form.priority;
        changeLogs.push({ update_type: "שינוי עדיפות", field: "עדיפות", old_value: editing.priority, new_value: form.priority, text: `העדיפות שונתה מ-${editing.priority} ל-${form.priority}` });
      }
      await base44.entities.Gap.update(editing.id, form);
      if (changeLogs.length > 0) {
        await base44.entities.GapUpdate.bulkCreate(
          changeLogs.map((c) => ({ ...c, gap_id: editing.id, author_name: user?.full_name || user?.email || "משתמש" }))
        );
      }
    } else {
      await base44.entities.Gap.create(form);
    }
    await loadGaps();
  };

  const handleStatusChange = async (gap, status) => {
    if (gap.status === status) return;
    await base44.entities.Gap.update(gap.id, { status });
    await base44.entities.GapUpdate.create({
      gap_id: gap.id,
      update_type: "שינוי סטטוס",
      field: "סטטוס",
      old_value: gap.status,
      new_value: status,
      text: `הסטטוס שונה מ-${gap.status} ל-${status}`,
      author_name: user?.full_name || user?.email || "משתמש",
    });
    await loadGaps();
  };

  const handleBoardDragEnd = async (gapId, fromStatus, toStatus) => {
    if (fromStatus === toStatus) return;
    const gap = gaps.find((g) => g.id === gapId);
    if (!gap) return;
    // Optimistic UI: move the card to its new column immediately instead of
    // waiting for the round-trip, otherwise the drag would visibly snap back
    // to the old column for a moment before the reload lands it correctly.
    setGaps((prev) => prev.map((g) => (g.id === gapId ? { ...g, status: toStatus } : g)));
    try {
      await handleStatusChange(gap, toStatus);
    } catch (err) {
      setGaps((prev) => prev.map((g) => (g.id === gapId ? { ...g, status: fromStatus } : g)));
      window.alert("שגיאה בעדכון סטטוס הפער: " + (err?.message || "שגיאה לא ידועה"));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await base44.entities.Gap.delete(deleting.id);
    setDeleting(null);
    await loadGaps();
  };

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (gap) => {
    setEditing(gap);
    setFormOpen(true);
  };

  const exportToExcel = () => {
    const data = filtered.map((g) => ({
      "פלוגה": g.company || "",
      "תיאור הפער": g.gap || "",
      "מיקום": g.location || "",
      "כיתה": g.class_name || "",
      "מספר מבנה": g.building_number || "",
      "מספר חדר": g.room_number || "",
      "סטטוס": g.status || "",
      "עדיפות": g.priority || "",
      "שם פותח הפער": g.reporter_name || "",
      "טלפון פותח הפער": g.reporter_phone || "",
      "הערות": g.note || "",
      "תאריך יצירה": g.created_date ? new Date(g.created_date).toLocaleDateString("he-IL") : "",
      "תאריך עדכון": g.updated_date ? new Date(g.updated_date).toLocaleDateString("he-IL") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 10 }, { wch: 40 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "פערים לוגיסטיים");
    XLSX.writeFile(wb, "פערים_לוגיסטיים.xlsx");
  };

  return (
    <>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">מעקב פערי בנייה</h1>
              <p className="text-xs text-muted-foreground">ניהול ליקויים ומשימות בפרויקט</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={exportToExcel}
              className="gap-2"
              disabled={filtered.length === 0}
              title={filtered.length < stats.total ? `מייצא ${filtered.length} מתוך ${stats.total} פערים (מסונן)` : `מייצא את כל ${stats.total} הפערים`}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">
                {filtered.length < stats.total ? `ייצא ${filtered.length} מסונן` : "ייצוא לאקסל"}
              </span>
            </Button>
            <Button onClick={openAdd} className="gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">הוסף פער</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="סה״כ פערים" value={stats.total} tone="slate" />
          <StatCard label="טרם הועלה" value={stats["טרם הועלה"]} tone="amber" />
          <StatCard label="בטיפול" value={stats["בטיפול"]} tone="blue" />
          <StatCard label="טופל" value={stats["טופל"]} tone="emerald" />
        </div>

        {/* View toggles: board (Jira-style, default) vs list, and — only for
            the list — active vs archive. */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setLayoutMode("board")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                layoutMode === "board" ? "bg-white text-slate-900 shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              לוח
            </button>
            <button
              onClick={() => setLayoutMode("list")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                layoutMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="w-4 h-4" />
              רשימה
            </button>
          </div>

          {layoutMode === "list" && (
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 max-w-xs">
              <button
                onClick={() => setArchiveView("active")}
                className={cn(
                  "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  archiveView === "active" ? "bg-white text-slate-900 shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                פעילים
              </button>
              <button
                onClick={() => setArchiveView("archive")}
                className={cn(
                  "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  archiveView === "archive" ? "bg-white text-slate-900 shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                ארכיון
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <GapFilters
          search={search}
          setSearch={setSearch}
          statusFilters={statusFilters}
          setStatusFilters={setStatusFilters}
          priorityFilters={priorityFilters}
          setPriorityFilters={setPriorityFilters}
          companyFilter={companyFilter}
          setCompanyFilter={setCompanyFilter}
          companies={companies}
          sort={sort}
          setSort={setSort}
          staleOnly={staleOnly}
          setStaleOnly={setStaleOnly}
          staleDays={staleDays}
          setStaleDays={setStaleDays}
        />

        {/* Board / List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : layoutMode === "board" ? (
          <GapBoard
            gaps={filtered}
            onDragEnd={handleBoardDragEnd}
            onEdit={openEdit}
            onDelete={setDeleting}
            onClick={setDetailGap}
            staleDays={staleDays}
          />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">
              {archiveView === "archive" ? "אין פערים בארכיון" : "אין פערים להצגה"}
            </p>
            <p className="text-sm mt-1">
              {archiveView === "archive" ? "פערים שיטופלו יופיעו כאן." : "שנה את הסננים או הוסף פער חדש."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((gap) => (
              <GapCard
                key={gap.id}
                gap={gap}
                onEdit={openEdit}
                onDelete={setDeleting}
                onStatusChange={handleStatusChange}
                onClick={setDetailGap}
                staleDays={staleDays}
              />
            ))}
          </div>
        )}
      </main>

      <GapForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        editing={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת פער</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את הפער? פעולה זו אינה הפיכה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GapDetail
        gap={detailGap}
        open={!!detailGap}
        onClose={() => setDetailGap(null)}
        onEdit={(gap) => {
          setDetailGap(null);
          openEdit(gap);
        }}
        onStatusChange={async (gap, status) => {
          await handleStatusChange(gap, status);
          setDetailGap({ ...gap, status });
        }}
      />
    </>
  );
}

function StatCard({ label, value, tone, icon }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
  };
  return (
    <div className="bg-white rounded-xl border border-border p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tones[tone]}`}>
        {icon || <span className="text-lg font-bold">{value}</span>}
      </div>
      <div>
        {icon && <p className="text-2xl font-bold leading-none">{value}</p>}
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}