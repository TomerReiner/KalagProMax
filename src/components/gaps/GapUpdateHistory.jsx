import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_STYLES = {
  "שינוי סטטוס": { bg: "bg-blue-50", border: "border-blue-200", badge: "bg-blue-100 text-blue-700", icon: "🔄" },
  "שינוי עדיפות": { bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-100 text-orange-700", icon: "⚡" },
  "עדכון כללי": { bg: "bg-slate-50", border: "border-slate-200", badge: "bg-slate-100 text-slate-700", icon: "📝" },
  "תגובה": { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700", icon: "💬" },
};

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function GapUpdateHistory({ gapId, user }) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await base44.entities.GapUpdate.filter({ gap_id: gapId }, "-created_date", 200);
      setUpdates(data);
    } finally {
      setLoading(false);
    }
  }, [gapId]);

  useEffect(() => {
    setLoading(true);
    load();
    const unsubscribe = base44.entities.GapUpdate.subscribe(() => load());
    return unsubscribe;
  }, [load]);

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    setSaving(true);
    try {
      await base44.entities.GapUpdate.create({
        gap_id: gapId,
        update_type: "תגובה",
        text: comment.trim(),
        author_name: user?.full_name || user?.email || "משתמש",
      });
      setComment("");
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <span>היסטוריית עדכונים ותגובות</span>
        <span className="text-xs text-muted-foreground font-normal">({updates.length})</span>
      </div>

      {/* Add comment */}
      <div className="space-y-2">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="הוסף עדכון או תגובה..."
          rows={2}
          dir="rtl"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleAddComment} disabled={saving || !comment.trim()} className="gap-1">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            פרסם עדכון
          </Button>
        </div>
      </div>

      {/* History list */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : updates.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">אין עדכונים עדיין</p>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pl-1">
          {updates.map((u) => {
            const styles = TYPE_STYLES[u.update_type] || TYPE_STYLES["תגובה"];
            return (
              <div key={u.id} className={cn("rounded-lg border p-3 space-y-1.5", styles.bg, styles.border)}>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", styles.badge)}>
                    {styles.icon} {u.update_type}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(u.created_date)}</span>
                </div>
                {u.text && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{u.text}</p>
                )}
                {(u.old_value || u.new_value) && !u.text && (
                  <p className="text-sm text-muted-foreground">
                    {u.old_value || "—"} ← {u.new_value || "—"}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">פורסם על ידי: {u.author_name || "משתמש"}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}