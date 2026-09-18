import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Building2, Clock, CalendarPlus, CalendarCheck, Pencil, FileText, Phone, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLUGA_COLORS } from "@/lib/constants";
import { base44 } from "@/api/base44Client";
import GapUpdateHistory from "@/components/gaps/GapUpdateHistory";
import AttachmentGallery from "@/components/gaps/AttachmentGallery";

const STATUS_THEME = {
  "טרם הועלה": { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  "בטיפול": { bg: "bg-blue-50", border: "border-blue-200", badge: "bg-blue-100 text-blue-800 border-blue-200", dot: "bg-blue-500" },
  "טופל": { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
};

const PRIORITY_STYLES = {
  "נמוך": "bg-slate-100 text-slate-600",
  "בינוני": "bg-sky-100 text-sky-700",
  "גבוה": "bg-orange-100 text-orange-700",
  "קריטי": "bg-red-100 text-red-700 ring-1 ring-red-200",
};

const HOUSING_LOCATIONS = ["מגורים כללי", "מגורי בנים", "מגורי בנות", "כניסה למגורי בנים", "כניסה למגורי בנות"];

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export default function GapDetail({ gap, open, onClose, onEdit, onStatusChange }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  if (!gap) return null;
  const theme = STATUS_THEME[gap.status] || STATUS_THEME["טרם הועלה"];
  const days = daysSince(gap.updated_date);
  const isStale = days != null && days >= 7 && gap.status !== "טופל";
  const plugaColor = PLUGA_COLORS[gap.company] || {};
  const isHousing = HOUSING_LOCATIONS.includes(gap.location);
  const locationLabel = [
    gap.location,
    gap.location === "כיתות" && gap.class_name ? ` - כיתה ${gap.class_name}` : "",
    isHousing && gap.building_number ? ` - מבנה ${gap.building_number}` : "",
    isHousing && gap.room_number ? ` - חדר ${gap.room_number}` : "",
  ].filter(Boolean).join("");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[600px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={cn("w-3 h-3 rounded-full", plugaColor.dot || theme.dot)} />
            פרטי פער
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status and Priority badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-sm font-medium px-3 py-1 rounded-full border", theme.badge)}>
              {gap.status}
            </span>
            <span className={cn("text-sm font-semibold px-3 py-1 rounded-full", PRIORITY_STYLES[gap.priority])}>
              עדיפות {gap.priority}
            </span>
            {isStale && (
              <span className="text-sm font-medium px-3 py-1 rounded-full bg-amber-200 text-amber-900 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                לא עודכן {days} ימים
              </span>
            )}
          </div>

          {/* Description */}
          <div className={cn("rounded-lg border p-4", theme.bg, theme.border)}>
            <p className="text-base font-medium leading-relaxed">{gap.gap}</p>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            {gap.company && (
              <div className="flex items-center gap-2 text-sm">
                <span className={cn("w-3 h-3 rounded-full", plugaColor.dot)} />
                <span className="text-muted-foreground">פלוגה:</span>
                <span className="font-medium">{gap.company}</span>
              </div>
            )}
            {gap.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">מיקום:</span>
                <span className="font-medium">{locationLabel}</span>
              </div>
            )}
            {gap.created_date && (
              <div className="flex items-center gap-2 text-sm">
                <CalendarPlus className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">נפתח:</span>
                <span className="font-medium">{formatShortDate(gap.created_date)}</span>
              </div>
            )}
            {gap.updated_date && (
              <div className="flex items-center gap-2 text-sm">
                <CalendarCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">עודכן:</span>
                <span className="font-medium">{formatShortDate(gap.updated_date)}</span>
              </div>
            )}
          </div>

          {/* Reporter contact */}
          {(gap.reporter_name || gap.reporter_phone) && (
            <div className="rounded-lg border border-border bg-slate-50 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-slate-700">פרטי איש קשר של פותח הפער</p>
              {gap.reporter_name && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{gap.reporter_name}</span>
                </div>
              )}
              {gap.reporter_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium" dir="ltr">{gap.reporter_phone}</span>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {gap.note && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <FileText className="w-4 h-4" />
                הערות
              </div>
              <div className="bg-muted/60 rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap">
                {gap.note}
              </div>
            </div>
          )}

          {/* Attachments */}
          {gap.attachments?.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <FileText className="w-4 h-4" />
                קבצים מצורפים ({gap.attachments.length})
              </div>
              <AttachmentGallery attachments={gap.attachments} size="lg" />
            </div>
          )}

          {/* Update history */}
          <GapUpdateHistory gapId={gap.id} user={user} />

          {/* Status change */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <span className="text-sm text-muted-foreground">שנה סטטוס:</span>
            {["טרם הועלה", "בטיפול", "טופל"].map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(gap, s)}
                className={cn(
                  "text-sm px-3 py-1.5 rounded-full border transition-colors",
                  gap.status === s
                    ? (STATUS_THEME[s] || STATUS_THEME["טרם הועלה"]).badge
                    : "bg-transparent text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Edit button */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onEdit(gap)} className="gap-2">
              <Pencil className="w-4 h-4" />
              עריכת פער
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}