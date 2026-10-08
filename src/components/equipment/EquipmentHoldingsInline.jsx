import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { PLUGA_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Undo2, PackageOpen, Download, AlarmClock } from "lucide-react";
import * as XLSX from "xlsx";
import { daysOverdue } from "@/lib/battalion";

// "ציוד בשימוש" — everything currently out of the warehouses. Overdue items
// (past expected_return_date) are sorted first with a red "באיחור N ימים"
// badge, and a one-click "רק באיחור" filter makes chasing them easy. The
// section has id="holdings" so ?tab=holdings (e.g. from תמונת מצב) can
// scroll straight to it.
export default function EquipmentHoldingsInline({ holdings, canEdit, onReturn }) {
  const [overdueOnly, setOverdueOnly] = useState(false);
  const withLate = holdings.map((h) => ({ ...h, late: h.expected_return_date ? daysOverdue(h.expected_return_date) : 0 }));
  const overdueCount = withLate.filter((h) => h.late > 0).length;
  const shown = withLate
    .filter((h) => !overdueOnly || h.late > 0)
    .sort((a, b) => b.late - a.late || String(a.expected_return_date || "9").localeCompare(String(b.expected_return_date || "9")));

  const exportToExcel = () => {
    const data = withLate.map((h) => ({
      "פריט": h.item_name || "",
      "כמות": h.quantity || "",
      "מחסן": h.warehouse || "",
      "פלוגה": h.pluga || "",
      "מחזיק": h.held_by_name || "",
      "תאריך משיכה": h.withdrawal_date || "",
      "תאריך החזרה צפוי": h.expected_return_date || "",
      "ימי איחור": h.late > 0 ? h.late : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 24 }, { wch: 8 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ציוד מחוץ למחסן");
    XLSX.writeFile(wb, "ציוד_מחוץ_למחסן.xlsx");
  };

  return (
    <div id="holdings" className="space-y-2 scroll-mt-32">
      <div className="flex items-center gap-2 flex-wrap">
        <PackageOpen className="w-4 h-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-muted-foreground">
          ציוד בשימוש ({holdings.length})
        </h2>
        {overdueCount > 0 && (
          <button
            onClick={() => setOverdueOnly((x) => !x)}
            className={cn(
              "text-xs px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1",
              overdueOnly ? "bg-red-600 text-white border-red-600" : "bg-red-50 text-red-700 border-red-200"
            )}
          >
            <AlarmClock className="w-3 h-3" />
            {overdueCount} באיחור{overdueOnly ? " · הצג הכל" : ""}
          </button>
        )}
        {holdings.length > 0 && (
          <Button variant="ghost" size="sm" onClick={exportToExcel} className="gap-1 mr-auto h-7 text-xs">
            <Download className="w-3.5 h-3.5" />
            ייצוא לאקסל
          </Button>
        )}
      </div>
      {holdings.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border border-border rounded-xl bg-white">
          <p className="text-sm">אין ציוד בשימוש כרגע</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((h) => (
            <div
              key={h.id}
              className={cn(
                "flex items-center gap-3 rounded-lg p-3 border",
                h.late > 0 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                  {h.item_name} ×{h.quantity}
                  {h.late > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-red-600 text-white font-semibold">
                      באיחור {h.late} {h.late === 1 ? "יום" : "ימים"}
                    </span>
                  )}
                  {h.untracked && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">לא מהמלאי</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {h.warehouse} · נמשך ע"י {h.held_by_name} ב-{h.withdrawal_date}
                  {h.expected_return_date ? ` · החזרה: ${h.expected_return_date}` : " · ללא תאריך החזרה"}
                </p>
              </div>
              <span
                className={cn(
                  "text-xs px-2 py-1 rounded-full font-medium shrink-0",
                  PLUGA_COLORS[h.pluga]?.light || "bg-muted"
                )}
              >
                {h.pluga}
              </span>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onReturn(h)}
                  className="gap-1 shrink-0 bg-white"
                >
                  <Undo2 className="w-3.5 h-3.5" /> הוחזר
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
