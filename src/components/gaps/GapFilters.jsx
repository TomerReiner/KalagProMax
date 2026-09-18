import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUSES = ["טרם הועלה", "בטיפול", "טופל"];
const PRIORITIES = ["נמוך", "בינוני", "גבוה", "קריטי"];

export default function GapFilters({
  search,
  setSearch,
  statusFilters,
  setStatusFilters,
  priorityFilters,
  setPriorityFilters,
  companyFilter,
  setCompanyFilter,
  companies,
  sort,
  setSort,
  staleOnly,
  setStaleOnly,
  staleDays,
  setStaleDays,
}) {
  const toggleStatus = (s) => {
    setStatusFilters((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };
  const togglePriority = (p) => {
    setPriorityFilters((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  return (
    <div dir="rtl" className="flex flex-col gap-3">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש חופשי בתיאור, מיקום, פלוגה..."
            className="pr-10"
          />
        </div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="md:w-[170px]"><SelectValue placeholder="פלוגה" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הפלוגות</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="md:w-[200px]">
            <SlidersHorizontal className="w-4 h-4 ml-1" />
            <SelectValue placeholder="מיון" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">חשיבות (גבוהה → נמוכה)</SelectItem>
            <SelectItem value="stale">לא עודכן לאחרונה (ישן → חדש)</SelectItem>
            <SelectItem value="newest">חדש ביותר</SelectItem>
            <SelectItem value="oldest">ישן ביותר</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">סטטוס:</span>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => toggleStatus(s)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              statusFilters.includes(s)
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {s}
          </button>
        ))}
        {statusFilters.length > 0 && (
          <button onClick={() => setStatusFilters([])} className="text-xs text-muted-foreground hover:text-foreground underline">
            נקה
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">עדיפות:</span>
        {PRIORITIES.map((p) => (
          <button
            key={p}
            onClick={() => togglePriority(p)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              priorityFilters.includes(p)
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {p}
          </button>
        ))}
        {priorityFilters.length > 0 && (
          <button onClick={() => setPriorityFilters([])} className="text-xs text-muted-foreground hover:text-foreground underline">
            נקה
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={staleOnly}
            onChange={(e) => setStaleOnly(e.target.checked)}
            className="w-4 h-4 accent-amber-500"
          />
          <span className="text-muted-foreground">הצג רק פערים שלא עודכנו</span>
          <Input
            type="number"
            min={1}
            value={staleDays}
            onChange={(e) => setStaleDays(Math.max(1, Number(e.target.value) || 1))}
            className="w-20 h-8"
          />
          <span className="text-muted-foreground">ימים או יותר</span>
        </label>
      </div>
    </div>
  );
}