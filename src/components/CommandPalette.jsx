import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Command as CommandPrimitive } from "cmdk";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Search, HardHat, CalendarRange, Package, Truck, ClipboardCheck, Plus, Megaphone, Wand2, Loader2, CornerDownLeft,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PAGE_TITLES } from "@/lib/pageTitles";
import { ROLE_PAGES, canOpenPage } from "@/lib/rolePages";
import { PLUGA_COLORS, formatHebrewDate, toDateStr } from "@/lib/constants";
import { orderItems } from "@/lib/playbox";
import { cn } from "@/lib/utils";

// Global search + quick actions ("Ctrl/⌘ K", or "/" anywhere outside a text
// field, or the search button in the header). One box over every content
// world in the app — gaps, events, warehouse items, Playbox orders, tasks —
// plus the pages this role can open and the most common "create" actions.
// Every result is a deep link (see the ?gap= / ?event= / ?order= / ?q=
// handling in the target pages), so picking one lands exactly on it.
//
// Data is fetched lazily each time the palette opens (cheap: a handful of
// list() calls), and the data groups only render once something is typed so
// the empty state stays a short, scannable menu.
const STATUS_DOT = { "טרם הועלה": "bg-amber-400", "בטיפול": "bg-blue-500", "טופל": "bg-emerald-500" };

// Every typed word must appear somewhere in the item (substring, any order).
// cmdk's default fuzzy scoring matches scattered letters, which in Hebrew
// pulls in lots of unrelated rows ("ברז" matching "מזגן... בכיתה").
function strictFilter(value, search) {
  const hay = value.toLowerCase();
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => hay.includes(w)) ? 1 : 0;
}

// Lets any page open the palette (e.g. the "חיפוש" button on תמונת מצב)
// without threading state through the layout.
const OPEN_EVENT = "open-command-palette";
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function useCommandPaletteHotkey(setOpen) {
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [setOpen]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || e.target?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K" || e.code === "KeyK")) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}

export default function CommandPalette({ open, setOpen, effectiveRole }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const canEquipment = canOpenPage(effectiveRole, "/equipment");
  const tasksPath = canOpenPage(effectiveRole, "/tasks") ? "/tasks" : canOpenPage(effectiveRole, "/klaf") ? "/klaf" : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const safe = (p) => p.catch(() => []);
      const [gaps, events, items, orders, tasks] = await Promise.all([
        safe(base44.entities.Gap.list("-created_date", 500)),
        safe(base44.entities.Event.list("-event_date", 300)),
        canEquipment ? safe(base44.entities.WarehouseItem.list()) : Promise.resolve([]),
        safe(base44.entities.PlayboxOrder.list("-order_date", 200)),
        tasksPath ? safe(base44.entities.DirectTask.list("-created_date", 300)) : Promise.resolve([]),
      ]);
      setData({ gaps, events, items, orders, tasks });
    } finally {
      setLoading(false);
    }
  }, [canEquipment, tasksPath]);

  useEffect(() => {
    if (open) {
      setQuery("");
      load();
    }
  }, [open, load]);

  const go = (to) => {
    setOpen(false);
    navigate(to);
  };

  const pages = (ROLE_PAGES[effectiveRole] || []).filter((p) => PAGE_TITLES[p]);
  const isOverviewRole = canOpenPage(effectiveRole, "/overview");
  const actions = [
    { id: "new-gap", label: "דיווח על פער חדש", hint: "פתיחת טופס פער", icon: HardHat, to: "/?new=1" },
    { id: "new-order", label: "הזמנה חדשה בפלייבוקס", hint: "שם, תאריך ופריטים", icon: Truck, to: "/playbox?new=1" },
    isOverviewRole && { id: "brief", label: "בריף יומי לוואטסאפ", hint: "סיכום היום בלחיצה", icon: Megaphone, to: "/overview?brief=1" },
    { id: "shotaf-plan", label: "שיבוץ שוטף לשבוע", hint: "מתכנן אוטומטי הוגן", icon: Wand2, to: "/daily-summary?tab=shotaf&plan=1" },
  ].filter(Boolean);

  const typed = query.trim().length > 0;
  const today = toDateStr(new Date());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent hideClose className="overflow-hidden p-0 gap-0 sm:max-w-xl top-[12%] translate-y-0 data-[state=open]:slide-in-from-top-4" dir="rtl">
        <DialogTitle className="sr-only">חיפוש בכל המערכת</DialogTitle>
        <CommandPrimitive className="flex flex-col" loop filter={strictFilter}>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <CommandPrimitive.Input
              value={query}
              onValueChange={setQuery}
              placeholder="חיפוש פערים, אירועים, ציוד, הזמנות, עמודים..."
              className="flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
          </div>
          <CommandPrimitive.List className="max-h-[60vh] overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground">
            <CommandPrimitive.Empty className="py-8 text-center text-sm text-muted-foreground">
              לא נמצא כלום עבור "{query}"
            </CommandPrimitive.Empty>

            <CommandPrimitive.Group heading="פעולות מהירות">
              {actions.map((a) => (
                <PaletteItem key={a.id} value={`action ${a.label} ${a.hint}`} onSelect={() => go(a.to)} icon={a.icon} title={a.label} subtitle={a.hint} accent />
              ))}
            </CommandPrimitive.Group>

            <CommandPrimitive.Group heading="מעבר לעמוד">
              {pages.map((p) => (
                <PaletteItem key={p} value={`page ${PAGE_TITLES[p].label} ${p}`} onSelect={() => go(p)} icon={PAGE_TITLES[p].icon} title={PAGE_TITLES[p].label} />
              ))}
            </CommandPrimitive.Group>

            {typed && data && (
              <>
                <CommandPrimitive.Group heading="פערים">
                  {data.gaps.map((g) => (
                    <PaletteItem
                      key={g.id}
                      value={`gap ${g.gap} ${g.location || ""} ${g.company || ""} ${g.note || ""} ${g.status} ${g.id}`}
                      onSelect={() => go(`/?gap=${g.id}`)}
                      icon={HardHat}
                      title={g.gap}
                      subtitle={[g.company, g.location, g.priority && `עדיפות ${g.priority}`].filter(Boolean).join(" · ")}
                      dot={STATUS_DOT[g.status]}
                      badge={g.status}
                    />
                  ))}
                </CommandPrimitive.Group>

                <CommandPrimitive.Group heading="אירועים">
                  {data.events.map((e) => {
                    const plugot = [e.transport_pluga, e.food_pluga, ...(e.responsible_plugas || [])].filter(Boolean);
                    return (
                      <PaletteItem
                        key={e.id}
                        value={`event ${e.title} ${e.details || ""} ${plugot.join(" ")} ${e.event_type} ${e.id}`}
                        onSelect={() => go(`/constraints?event=${e.id}&date=${String(e.event_date).slice(0, 10)}`)}
                        icon={CalendarRange}
                        title={e.title}
                        subtitle={`${formatHebrewDate(String(e.event_date).slice(0, 10))} · ${e.start_time}–${e.end_time}`}
                        badge={String(e.event_date).slice(0, 10) < today ? "עבר" : e.event_type}
                        dot={plugot[0] ? PLUGA_COLORS[plugot[0]]?.dot : undefined}
                      />
                    );
                  })}
                </CommandPrimitive.Group>

                {data.items.length > 0 && (
                  <CommandPrimitive.Group heading="ציוד במחסנים">
                    {data.items.map((i) => (
                      <PaletteItem
                        key={i.id}
                        value={`item ${i.name} ${i.warehouse} ${i.id}`}
                        onSelect={() => go(`/equipment?w=${encodeURIComponent(i.warehouse)}&q=${encodeURIComponent(i.name)}`)}
                        icon={Package}
                        title={i.name}
                        subtitle={`${i.warehouse} · במלאי ${i.quantity}`}
                        badge={Number(i.target_quantity) > 0 && Number(i.quantity) < Number(i.target_quantity) ? "חסר" : undefined}
                      />
                    ))}
                  </CommandPrimitive.Group>
                )}

                <CommandPrimitive.Group heading="הזמנות פלייבוקס">
                  {data.orders.map((o) => {
                    const names = orderItems(o).map((i) => i.name);
                    return (
                      <PaletteItem
                        key={o.id}
                        value={`order ${o.name || ""} ${names.join(" ")} ${o.status} ${o.id}`}
                        onSelect={() => go(`/playbox?order=${o.id}`)}
                        icon={Truck}
                        title={o.name || names[0] || "הזמנה"}
                        subtitle={`${o.order_date || ""} · ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}`}
                        badge={o.status}
                      />
                    );
                  })}
                </CommandPrimitive.Group>

                {tasksPath && data.tasks.length > 0 && (
                  <CommandPrimitive.Group heading="משימות">
                    {data.tasks.map((t) => {
                      const plugot = t.responsible_plugas?.length ? t.responsible_plugas : t.pluga ? [t.pluga] : [];
                      return (
                        <PaletteItem
                          key={t.id}
                          value={`task ${t.title} ${t.notes || ""} ${plugot.join(" ")} ${t.id}`}
                          onSelect={() => go(tasksPath)}
                          icon={ClipboardCheck}
                          title={t.title}
                          subtitle={[t.task_date ? formatHebrewDate(t.task_date) : "ללא תאריך", plugot.join(", ")].filter(Boolean).join(" · ")}
                          badge={t.status}
                        />
                      );
                    })}
                  </CommandPrimitive.Group>
                )}
              </>
            )}
          </CommandPrimitive.List>
          <div className="flex items-center justify-between gap-2 border-t px-4 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3" /> לפתיחה
            </span>
            <span>
              <kbd className="rounded border bg-muted px-1">Ctrl</kbd> + <kbd className="rounded border bg-muted px-1">K</kbd> מכל מקום
            </span>
          </div>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}

function PaletteItem({ value, onSelect, icon: Icon = Plus, title, subtitle, badge, dot, accent }) {
  return (
    <CommandPrimitive.Item
      value={value}
      onSelect={onSelect}
      className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm cursor-pointer aria-selected:bg-slate-100 data-[selected=true]:bg-slate-100"
    >
      <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", accent ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600")}>
        <Icon className="w-4 h-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          {dot && <span className={cn("w-2 h-2 rounded-full shrink-0", dot)} />}
          <span className="font-medium truncate">{title}</span>
        </span>
        {subtitle && <span className="block text-xs text-muted-foreground truncate">{subtitle}</span>}
      </span>
      {badge && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">{badge}</span>}
    </CommandPrimitive.Item>
  );
}
