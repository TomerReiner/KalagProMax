import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ClipboardCheck, Search, Plus, X, Download, Check } from "lucide-react";
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import { formatHebrewDate, toDateStr } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// "ספירת מלאי" — walk the warehouse, type what's actually on the shelf, see
// every difference live, then fix the system quantities in one click.
//  - Blank = not counted (left unchanged). "תואם" fills in the system number.
//  - Items found on the shelf but missing from the list can be added.
//  - The in-progress count is kept on this device (localStorage), so a count
//    interrupted halfway (phone locked, tab closed) picks up where it was.
//  - "דוח ספירה" exports the whole count (system / counted / diff) to Excel.
const draftKey = (warehouse) => `inventoryCountDraft:${warehouse}`;

function loadDraft(warehouse) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(warehouse)) || "null");
  } catch {
    return null;
  }
}
function saveDraft(warehouse, draft) {
  try {
    localStorage.setItem(draftKey(warehouse), JSON.stringify(draft));
  } catch {
    // storage unavailable — the count just won't survive a reload
  }
}
function clearDraft(warehouse) {
  try {
    localStorage.removeItem(draftKey(warehouse));
  } catch {
    // ignore
  }
}

export default function InventoryCountDialog({ open, onClose, warehouse, items, onApplied }) {
  const { toast } = useToast();
  const [counts, setCounts] = useState({});
  const [extras, setExtras] = useState([]);
  const [newItem, setNewItem] = useState({ name: "", quantity: "" });
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const draft = loadDraft(warehouse);
    setCounts(draft?.counts || {});
    setExtras(draft?.extras || []);
    setSearch("");
  }, [open, warehouse]);

  useEffect(() => {
    if (open) saveDraft(warehouse, { counts, extras });
  }, [open, warehouse, counts, extras]);

  const rows = useMemo(
    () =>
      [...items]
        .sort((a, b) => a.name.localeCompare(b.name, "he"))
        .map((i) => {
          const raw = counts[i.id];
          const counted = raw === undefined || raw === "" ? null : Number(raw);
          return { item: i, counted, diff: counted == null ? null : counted - Number(i.quantity) };
        }),
    [items, counts]
  );
  const visible = rows.filter((r) => !search.trim() || r.item.name.includes(search.trim()));
  const countedN = rows.filter((r) => r.counted != null).length;
  const changed = rows.filter((r) => r.diff != null && r.diff !== 0);
  const missing = changed.filter((r) => r.diff < 0).reduce((s, r) => s + -r.diff, 0);
  const surplus = changed.filter((r) => r.diff > 0).reduce((s, r) => s + r.diff, 0);

  const setCount = (id, value) => setCounts((c) => ({ ...c, [id]: value }));

  const addExtra = () => {
    const name = newItem.name.trim();
    if (!name) return;
    setExtras((x) => [...x, { name, quantity: Math.max(0, Number(newItem.quantity) || 0) }]);
    setNewItem({ name: "", quantity: "" });
  };

  const exportReport = () => {
    const today = toDateStr(new Date());
    const data = [
      ...rows.map((r) => ({
        "פריט": r.item.name,
        "במערכת": Number(r.item.quantity),
        "נספר": r.counted ?? "לא נספר",
        "הפרש": r.diff ?? "",
      })),
      ...extras.map((x) => ({ "פריט": `${x.name} (חדש)`, "במערכת": 0, "נספר": x.quantity, "הפרש": x.quantity })),
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, ws, "ספירת מלאי");
    XLSX.writeFile(wb, `ספירת_מלאי_${warehouse}_${today}.xlsx`);
  };

  const apply = async () => {
    setSaving(true);
    try {
      for (const r of changed) {
        await base44.entities.WarehouseItem.update(r.item.id, { quantity: r.counted });
      }
      for (const x of extras) {
        await base44.entities.WarehouseItem.create({ warehouse, name: x.name, quantity: x.quantity, returnable: false });
      }
      clearDraft(warehouse);
      toast({ title: "המלאי עודכן לפי הספירה", description: `${changed.length} פריטים תוקנו${extras.length ? `, ${extras.length} נוספו` : ""}`, duration: 3000 });
      onApplied?.();
      onClose();
    } catch (err) {
      toast({ title: "שגיאה בעדכון המלאי", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setCounts({});
    setExtras([]);
    clearDraft(warehouse);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" /> ספירת מלאי — {warehouse}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          {formatHebrewDate(new Date())} · רשמו כמה ספרתם בפועל. שדה ריק = לא נספר ולא ישתנה. הספירה נשמרת במכשיר עד שמעדכנים.
        </p>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 border p-2">
            <p className="text-lg font-bold tabular-nums">{countedN}/{rows.length}</p>
            <p className="text-[11px] text-muted-foreground">נספרו</p>
          </div>
          <div className="rounded-xl bg-red-50 border border-red-100 p-2">
            <p className="text-lg font-bold tabular-nums text-red-700" dir="ltr">−{missing}</p>
            <p className="text-[11px] text-muted-foreground">חסרים</p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2">
            <p className="text-lg font-bold tabular-nums text-emerald-700" dir="ltr">+{surplus}</p>
            <p className="text-[11px] text-muted-foreground">עודפים</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש פריט..." className="pr-9" />
        </div>

        <div className="border rounded-xl divide-y max-h-[45vh] overflow-y-auto">
          {visible.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">אין פריטים</p>}
          {visible.map(({ item, counted, diff }) => (
            <div key={item.id} className={cn("flex items-center gap-2 px-3 py-2", diff != null && diff !== 0 && (diff < 0 ? "bg-red-50/60" : "bg-emerald-50/60"))}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-[11px] text-muted-foreground">במערכת: {item.quantity}</p>
              </div>
              <button
                onClick={() => setCount(item.id, String(item.quantity))}
                className={cn("text-[11px] px-2 py-1 rounded-md border shrink-0", counted === Number(item.quantity) ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600")}
                title="הכמות במערכת נכונה"
              >
                <Check className="w-3 h-3 inline" /> תואם
              </button>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                value={counts[item.id] ?? ""}
                onChange={(e) => setCount(item.id, e.target.value)}
                placeholder="נספר"
                className="w-20 h-9 text-center"
              />
              <span
                className={cn(
                  "w-12 text-center text-xs font-bold tabular-nums shrink-0",
                  diff == null ? "text-transparent" : diff === 0 ? "text-muted-foreground" : diff < 0 ? "text-red-700" : "text-emerald-700"
                )}
                dir="ltr"
              >
                {diff == null ? "·" : diff === 0 ? "0" : diff > 0 ? `+${diff}` : diff}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700">נמצא במחסן ולא מופיע ברשימה?</p>
          {extras.map((x, i) => (
            <div key={i} className="flex items-center gap-2 text-sm bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
              <span className="flex-1">{x.name} ×{x.quantity}</span>
              <span className="text-[10px] text-emerald-700">ייווסף</span>
              <button onClick={() => setExtras((xs) => xs.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newItem.name}
              onChange={(e) => setNewItem((n) => ({ ...n, name: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExtra())}
              placeholder="שם הפריט"
              className="h-9 flex-1"
            />
            <Input
              type="number"
              min="0"
              value={newItem.quantity}
              onChange={(e) => setNewItem((n) => ({ ...n, quantity: e.target.value }))}
              placeholder="כמות"
              className="h-9 w-20"
            />
            <Button variant="outline" size="sm" onClick={addExtra} disabled={!newItem.name.trim()} className="h-9 gap-1">
              <Plus className="w-3.5 h-3.5" /> הוסף
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
          <Button variant="ghost" onClick={reset} disabled={saving} className="ml-auto text-muted-foreground">
            התחל מחדש
          </Button>
          <Button variant="outline" onClick={exportReport} className="gap-1.5">
            <Download className="w-4 h-4" /> דוח ספירה
          </Button>
          <Button onClick={apply} disabled={saving || (changed.length === 0 && extras.length === 0)} className="gap-1.5">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {changed.length + extras.length === 0 ? "אין שינויים" : `עדכן מלאי (${changed.length + extras.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
