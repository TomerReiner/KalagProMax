import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Bell, CheckCheck, Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { PLUGA_COLORS } from "@/lib/constants";

const UPDATE_TYPE_STYLES = {
  "שינוי סטטוס": "bg-blue-100 text-blue-700",
  "שינוי עדיפות": "bg-amber-100 text-amber-700",
  "עדכון כללי": "bg-slate-100 text-slate-700",
  "תגובה": "bg-emerald-100 text-emerald-700",
};

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק'`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `לפני ${days} ימים`;
  return new Date(dateStr).toLocaleDateString("he-IL");
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [updates, setUpdates] = useState([]);
  const [gaps, setGaps] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [lastRead, setLastRead] = useState(null);
  const [marking, setMarking] = useState(false);

  const loadUser = useCallback(async () => {
    const u = await base44.auth.me().catch(() => null);
    if (!u) return;
    setUser(u);
    setLastRead(u.notifications_last_read || null);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [updatesData, gapsData, announcementsData] = await Promise.all([
        base44.entities.GapUpdate.list("-created_date", 100),
        base44.entities.Gap.list("-created_date", 500),
        base44.entities.Announcement.list("-created_date", 50),
      ]);
      setUpdates(updatesData);
      const gapMap = {};
      gapsData.forEach((g) => { gapMap[g.id] = g; });
      setGaps(gapMap);
      setAnnouncements(announcementsData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  // Subscribe to new gap updates + announcements for a live badge.
  useEffect(() => {
    const unsubGapUpdates = base44.entities.GapUpdate.subscribe(() => {
      if (open) loadData();
      else loadUser();
    });
    const unsubAnnouncements = base44.entities.Announcement.subscribe(() => {
      if (open) loadData();
      else loadUser();
    });
    return () => {
      unsubGapUpdates();
      unsubAnnouncements();
    };
  }, [open, loadData, loadUser]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const unreadCount = useMemo(() => {
    const unreadUpdates = !lastRead ? updates.length : updates.filter((u) => new Date(u.created_date) > new Date(lastRead)).length;
    const unreadAnnouncements = !lastRead ? announcements.length : announcements.filter((a) => new Date(a.created_date) > new Date(lastRead)).length;
    return unreadUpdates + unreadAnnouncements;
  }, [updates, announcements, lastRead]);

  const markAllRead = async () => {
    setMarking(true);
    try {
      const now = new Date().toISOString();
      await base44.auth.updateMe({ notifications_last_read: now });
      setLastRead(now);
    } catch {
      // ignore
    } finally {
      setMarking(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        title="התראות"
      >
        <Bell className="w-5 h-5 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -left-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md p-0" dir="rtl">
          <SheetHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                התראות
                {unreadCount > 0 && (
                  <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">{unreadCount} חדשות</span>
                )}
              </SheetTitle>
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllRead}
                  disabled={marking}
                  className="gap-1 h-8"
                >
                  {marking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                  סמן הכל כנקרא
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="overflow-y-auto max-h-[calc(100vh-80px)]">
            {announcements.length > 0 && (
              <div className="divide-y divide-border border-b-4 border-border">
                {announcements.map((a) => {
                  const isUnread = !lastRead || new Date(a.created_date) > new Date(lastRead);
                  return (
                    <div
                      key={a.id}
                      className={cn("p-4 flex gap-3", isUnread ? "bg-amber-50/60" : "bg-background")}
                    >
                      <Megaphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{a.title}</span>
                          <span className="text-[11px] text-muted-foreground mr-auto">{formatTimeAgo(a.created_date)}</span>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{a.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {loading && updates.length === 0 ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : updates.length === 0 ? (
              announcements.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <Bell className="w-10 h-10 opacity-30" />
                  <p className="text-sm">אין עדכונים עדיין</p>
                </div>
              )
            ) : (
              <div className="divide-y divide-border">
                {updates.map((u) => {
                  const gap = gaps[u.gap_id];
                  const isUnread = !lastRead || new Date(u.created_date) > new Date(lastRead);
                  return (
                    <div
                      key={u.id}
                      className={cn(
                        "p-4 flex gap-3 transition-colors",
                        isUnread ? "bg-blue-50/50" : "bg-background"
                      )}
                    >
                      <div className="shrink-0 mt-1">
                        <span
                          className={cn(
                            "block w-2 h-2 rounded-full",
                            isUnread ? "bg-blue-500" : "bg-transparent"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              "text-[11px] px-1.5 py-0.5 rounded font-medium",
                              UPDATE_TYPE_STYLES[u.update_type] || "bg-slate-100 text-slate-600"
                            )}
                          >
                            {u.update_type}
                          </span>
                          {gap?.company && (
                            <span
                              className={cn(
                                "text-[11px] px-1.5 py-0.5 rounded-full",
                                PLUGA_COLORS[gap.company]?.light || "bg-muted"
                              )}
                            >
                              {gap.company}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground mr-auto">
                            {formatTimeAgo(u.created_date)}
                          </span>
                        </div>
                        {u.text && (
                          <p className="text-sm text-foreground">{u.text}</p>
                        )}
                        {gap?.gap && (
                          <p className="text-xs text-muted-foreground truncate">
                            פער: {gap.gap}
                          </p>
                        )}
                        {u.author_name && (
                          <p className="text-[11px] text-muted-foreground">ע"י {u.author_name}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}