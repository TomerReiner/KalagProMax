import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Megaphone, Search, RefreshCw } from "lucide-react";
import { formatHebrewDate } from "@/lib/constants";
import { usePreviewRole } from "@/lib/previewRoleContext";
import { effectivePermissions, hasPermission } from "@/lib/permissions";
import { openCommandPalette } from "@/components/CommandPalette";
import { useBattalionData } from "@/components/overview/useBattalionData";
import { buildAlerts } from "@/components/overview/alerts";
import { AlertsPanel, TodayAgenda, PlugaGrid, WeekStrip, SectionTitle, LastUpdated } from "@/components/overview/OverviewSections";
import PlugaDrilldown from "@/components/overview/PlugaDrilldown";
import DailyBriefDialog from "@/components/overview/DailyBriefDialog";

// "תמונת מצב" — the battalion command picture. One screen that answers, for
// admin / רס"ר / סגל: what needs my attention right now ("דורש טיפול"),
// what's happening today (one agenda across שוטף, events, recurring,
// tasks, meal entry times and constraints), how each pluga is doing (cards
// that drill down into a full per-pluga view, ?pluga=), and how the coming
// week looks. Plus the "בריף יומי" generator for the battalion WhatsApp.
//
// Deep links: ?pluga=<name> opens that pluga's drill-down, ?brief=1 opens
// the brief dialog (used by the global search's quick action).
function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "בוקר טוב";
  if (h >= 12 && h < 17) return "צהריים טובים";
  if (h >= 17 && h < 22) return "ערב טוב";
  return "לילה טוב";
}

export default function Overview() {
  const [user, setUser] = useState(null);
  const [myPermissions, setMyPermissions] = useState([]);
  const { previewRole } = usePreviewRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const [briefOpen, setBriefOpen] = useState(searchParams.get("brief") === "1");
  const selectedPluga = searchParams.get("pluga");

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);
  useEffect(() => {
    if (!user?.id) return;
    base44.entities.UserPermission.filter({ user_id: user.id }).then(setMyPermissions).catch(() => setMyPermissions([]));
  }, [user?.id]);

  useEffect(() => {
    if (searchParams.get("brief") === "1") {
      setBriefOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("brief");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const effectiveRole = previewRole || user?.role;
  const isAdmin = effectiveRole === "admin";
  const { data, loading, reload } = useBattalionData({ isAdmin: user?.role === "admin" && isAdmin });
  const perms = effectivePermissions(myPermissions, effectiveRole);
  const alerts = useMemo(
    () => (data ? buildAlerts(data, {
      isAdmin,
      canApprovePlaybox: hasPermission(perms, "playbox_orders"),
      canManageEquipment: isAdmin || hasPermission(perms, "equipment_manager"),
    }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, isAdmin, myPermissions, effectiveRole]
  );

  const selectPluga = (p) => {
    const next = new URLSearchParams(searchParams);
    if (p) next.set("pluga", p);
    else next.delete("pluga");
    setSearchParams(next);
    window.scrollTo({ top: 0 });
  };

  if (!user || loading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // task_completions are only readable in full by an admin (RLS: "read own
  // or admin"), so completion progress is only shown where it's real.
  const showCompletion = user.role === "admin";
  const today = new Date();
  const firstName = (user.full_name || "").split(" ")[0];
  const critical = alerts.filter((a) => a.level === "critical").length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-2xl font-black tracking-tight">{greeting()}{firstName ? `, ${firstName}` : ""}</p>
          <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
            {formatHebrewDate(today)}
            <span className="text-slate-300">|</span>
            {critical > 0 ? (
              <span className="text-red-600 font-medium">{critical} דברים דחופים</span>
            ) : alerts.length > 0 ? (
              <span>{alerts.length} דברים לטיפול</span>
            ) : (
              <span className="text-emerald-600 font-medium">הכל תקין</span>
            )}
            <LastUpdated at={data.loadedAt} />
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={reload} title="רענון">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={openCommandPalette} className="gap-2 hidden sm:inline-flex">
            <Search className="w-4 h-4" />
            חיפוש
            <kbd className="text-[10px] rounded border bg-muted px-1 text-muted-foreground">Ctrl K</kbd>
          </Button>
          <Button onClick={() => setBriefOpen(true)} className="gap-2">
            <Megaphone className="w-4 h-4" />
            בריף יומי
          </Button>
        </div>
      </div>

      {selectedPluga ? (
        <PlugaDrilldown data={data} pluga={selectedPluga} onSelect={selectPluga} showCompletion={showCompletion} />
      ) : (
        <>
          <section>
            <SectionTitle>דורש טיפול</SectionTitle>
            <AlertsPanel alerts={alerts} />
          </section>

          <section>
            <SectionTitle aside={<span className="text-[11px] text-muted-foreground">לחיצה על פלוגה פותחת את תמונת המצב שלה</span>}>פלוגות</SectionTitle>
            <PlugaGrid data={data} date={today} showCompletion={showCompletion} onSelect={selectPluga} />
          </section>

          <div className="grid gap-6 lg:grid-cols-5">
            <section className="lg:col-span-3">
              <SectionTitle>היום בגדוד</SectionTitle>
              <TodayAgenda data={data} date={today} isToday />
            </section>
            <section className="lg:col-span-2">
              <SectionTitle aside={<Link to="/print/week" className="text-xs text-muted-foreground hover:text-foreground">לוח שבועי להדפסה</Link>}>השבוע</SectionTitle>
              <WeekStrip data={data} />
              <p className="text-[11px] text-muted-foreground mt-2">
                הנקודות = משימות השוטף של היום (ירוק משובץ, אדום חסר). לחיצה על יום פותחת את לוח האילוצים.
              </p>
            </section>
          </div>
        </>
      )}

      <DailyBriefDialog open={briefOpen} onClose={() => setBriefOpen(false)} data={data} />
    </div>
  );
}
