import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";
import { PLUGA_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STATUS_LABELS = {
  pending: "ממתין לאישור",
  approved: "מאושר",
  rejected: "נדחה",
};

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

export default function WithdrawalHistory({ open, onClose }) {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [plugaFilter, setPlugaFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (open) {
      setLoading(true);
      base44.entities.WithdrawalRequest
        .list("-created_date", 200)
        .then(setWithdrawals)
        .finally(() => setLoading(false));
    }
  }, [open]);

  const filtered = useMemo(() => {
    return withdrawals.filter((w) => {
      if (plugaFilter !== "all" && w.pluga !== plugaFilter) return false;
      if (statusFilter !== "all" && w.status !== statusFilter) return false;
      return true;
    });
  }, [withdrawals, plugaFilter, statusFilter]);

  const exportToExcel = () => {
    const data = filtered.map((w) => ({
      "מבקש": w.requested_by_name || "",
      "פלוגה": w.pluga || "",
      "מחסן": w.warehouse || "",
      "תאריך בקשה": w.request_date || "",
      "תאריך החזרה צפוי": w.expected_return_date || "",
      "סטטוס": STATUS_LABELS[w.status] || w.status || "",
      "מאשר": w.approved_by_name || "",
      "פריטים": (w.items || []).map((i) => `${i.name} ×${i.quantity}${i.returnable ? " (להחזרה)" : ""}`).join(", "),
      "הערות": w.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 40 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "משיכות ציוד");
    XLSX.writeFile(wb, "משיכות_ציוד.xlsx");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>היסטוריית משיכות</DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={plugaFilter} onValueChange={setPlugaFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="פלוגה" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הפלוגות</SelectItem>
              {Object.keys(PLUGA_COLORS).map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="סטטוס" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              <SelectItem value="pending">ממתין לאישור</SelectItem>
              <SelectItem value="approved">מאושר</SelectItem>
              <SelectItem value="rejected">נדחה</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={filtered.length === 0} className="gap-1 mr-auto">
            <Download className="w-4 h-4" />
            ייצוא לאקסל
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">
            {withdrawals.length === 0 ? "אין משיכות עדיין" : "אין תוצאות לסינון"}
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((w) => (
              <div key={w.id} className="border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{w.requested_by_name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", PLUGA_COLORS[w.pluga]?.light || "bg-muted")}>
                      {w.pluga}
                    </span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_STYLES[w.status] || "bg-muted")}>
                      {STATUS_LABELS[w.status] || w.status}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {w.warehouse} · {w.request_date}
                  {w.expected_return_date ? ` · החזרה: ${w.expected_return_date}` : ""}
                </p>
                <div className="flex flex-wrap gap-1">
                  {w.items?.map((i, idx) => (
                    <span key={idx} className="text-xs bg-slate-100 px-2 py-0.5 rounded">
                      {i.name} ×{i.quantity}
                      {i.returnable ? " ↩" : ""}
                    </span>
                  ))}
                </div>
                {w.notes && <p className="text-xs text-muted-foreground">הערות: {w.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}