import React from "react";
import { Button } from "@/components/ui/button";
import { PLUGA_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Undo2, PackageOpen, Download } from "lucide-react";
import * as XLSX from "xlsx";

export default function EquipmentHoldingsInline({ holdings, canEdit, onReturn }) {
  const exportToExcel = () => {
    const data = holdings.map((h) => ({
      "פריט": h.item_name || "",
      "כמות": h.quantity || "",
      "מחסן": h.warehouse || "",
      "פלוגה": h.pluga || "",
      "מחזיק": h.held_by_name || "",
      "תאריך משיכה": h.withdrawal_date || "",
      "תאריך החזרה צפוי": h.expected_return_date || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 24 }, { wch: 8 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ציוד מחוץ למחסן");
    XLSX.writeFile(wb, "ציוד_מחוץ_למחסן.xlsx");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <PackageOpen className="w-4 h-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-muted-foreground">
          ציוד בשימוש ({holdings.length})
        </h2>
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
          {holdings.map((h) => (
            <div
              key={h.id}
              className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {h.item_name} ×{h.quantity}
                </p>
                <p className="text-xs text-muted-foreground">
                  {h.warehouse} · נמשך ע"י {h.held_by_name} ב-{h.withdrawal_date}
                  {h.expected_return_date ? ` · החזרה: ${h.expected_return_date}` : ""}
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
                  className="gap-1 shrink-0"
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