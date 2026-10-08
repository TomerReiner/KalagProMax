import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, MapPin, Clock, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLUGA_COLORS } from "@/lib/constants";
import AttachmentGallery from "@/components/gaps/AttachmentGallery";

const STATUS_THEME = {
  "טרם הועלה": { stripe: "border-r-4 border-r-amber-400", tint: "bg-amber-50/40", badge: "bg-amber-100 text-amber-800 border-amber-200" },
  "בטיפול": { stripe: "border-r-4 border-r-blue-400", tint: "bg-blue-50/40", badge: "bg-blue-100 text-blue-800 border-blue-200" },
  "טופל": { stripe: "border-r-4 border-r-emerald-400", tint: "bg-emerald-50/40", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

const PRIORITY_STYLES = {
  "נמוך": "bg-slate-100 text-slate-600",
  "בינוני": "bg-sky-100 text-sky-700",
  "גבוה": "bg-orange-100 text-orange-700",
  "קריטי": "bg-red-100 text-red-700 ring-1 ring-red-200",
};

const PRIORITY_RANK = { "קריטי": 4, "גבוה": 3, "בינוני": 2, "נמוך": 1 };

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function GapCard({ gap, onEdit, onDelete, onStatusChange, onClick, staleDays = 7 }) {
  const days = daysSince(gap.updated_date);
  const isStale = days != null && days >= staleDays && gap.status !== "טופל";
  const theme = STATUS_THEME[gap.status] || STATUS_THEME["טרם הועלה"];
  const plugaColor = PLUGA_COLORS[gap.company] || {};

  return (
    <Card
      dir="rtl"
      onClick={() => onClick?.(gap)}
      className={cn(
        "p-4 flex flex-col gap-3 transition-all hover:shadow-md cursor-pointer border-r-4",
        plugaColor.border || theme.stripe,
        theme.tint,
        isStale && "ring-2 ring-amber-300/70"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full border", theme.badge)}>
            {gap.status}
          </span>
          <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", PRIORITY_STYLES[gap.priority])}>
            {gap.priority}
          </span>
          {isStale && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-200 text-amber-900 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              לא עודכן {days} ימים
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button size="icon" variant="ghost" onClick={() => onEdit(gap)} className="h-8 w-8">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(gap)} className="h-8 w-8 text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <p className="text-sm font-medium text-foreground leading-relaxed">{gap.gap}</p>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {gap.company && (
          <span className="flex items-center gap-1">
            <span className={cn("w-2.5 h-2.5 rounded-full", plugaColor.dot)} />
            {gap.company}
          </span>
        )}
        {gap.location && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {gap.location}
            {gap.location === "כיתות" && gap.class_name ? ` - ${gap.class_name}` : ""}
          </span>
        )}
        {gap.created_date && (
          <span className="flex items-center gap-1">
            <CalendarPlus className="w-3.5 h-3.5" />
            נפתח {formatShortDate(gap.created_date)}
          </span>
        )}
      </div>

      {gap.note && (
        <p className="text-xs text-muted-foreground bg-muted/60 rounded-md p-2 leading-relaxed line-clamp-2">{gap.note}</p>
      )}

      {gap.attachments?.length > 0 && (
        <AttachmentGallery attachments={gap.attachments} size="sm" />
      )}

      <div className="flex items-center gap-2 pt-1 border-t border-border/60" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs text-muted-foreground">שנה סטטוס:</span>
        {["טרם הועלה", "בטיפול", "טופל"].map((s) => (
          <button
            key={s}
            onClick={() => onStatusChange(gap, s)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors",
              gap.status === s
                ? (STATUS_THEME[s] || STATUS_THEME["טרם הועלה"]).badge
                : "bg-transparent text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </Card>
  );
}

export { PRIORITY_RANK, daysSince };