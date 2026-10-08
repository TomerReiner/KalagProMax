import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ListChecks, Plus, X, CheckCircle2, Circle, Sparkles, ChevronDown } from "lucide-react";
import { PLUGOT, PLUGA_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CHECKLIST_TEMPLATES, newChecklistItem, withTemplate, checklistProgress } from "@/lib/eventChecklist";

// Event logistics checklist. Two modes:
//  - "edit" (inside EventForm): add / remove items, assign each to a pluga,
//    or drop in a ready-made template. Changes go through `onChange(items)`.
//  - "view" (event details, Klaf): tick items off. `onToggle(id)` saves
//    immediately. `pluga` limits the list to that pluga's items.
export default function EventChecklist({ items = [], mode = "view", onChange, onToggle, pluga, defaultPluga, compact = false }) {
  const [text, setText] = useState("");
  const [itemPluga, setItemPluga] = useState(defaultPluga || null);
  const list = pluga ? items.filter((i) => i.pluga === pluga) : items;
  const { done, total } = checklistProgress(list);

  if (mode === "view" && !list.length) return null;

  const add = () => {
    if (!text.trim()) return;
    onChange([...items, newChecklistItem(text, itemPluga)]);
    setText("");
  };

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      <div className="flex items-center gap-2">
        <ListChecks className="w-4 h-4 text-slate-500" />
        <p className={cn("font-semibold text-slate-700", compact ? "text-xs" : "text-sm")}>
          צ'קליסט לוגיסטי{pluga ? ` — ${pluga}` : ""}
        </p>
        {total > 0 && (
          <span className={cn("text-[11px] px-1.5 py-0.5 rounded-full tabular-nums", done === total ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>
            {done}/{total}
          </span>
        )}
        {mode === "edit" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="mr-auto text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> הוסף מתבנית <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" dir="rtl">
              {CHECKLIST_TEMPLATES.map((t) => (
                <DropdownMenuItem key={t.key} onSelect={() => onChange(withTemplate(items, t.key, defaultPluga))}>
                  {t.label} <span className="text-xs text-muted-foreground mr-1">({t.items.length})</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {total > 0 && (
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", done === total ? "bg-emerald-500" : "bg-slate-800")} style={{ width: `${(done / total) * 100}%` }} />
        </div>
      )}

      <ul className="space-y-1">
        {list.map((i) => (
          <li key={i.id} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5", i.done ? "bg-emerald-50/60" : "bg-slate-50")}>
            <button
              type="button"
              onClick={() => (mode === "edit" ? onChange(items.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x))) : onToggle?.(i.id))}
              className="shrink-0"
              aria-label={i.done ? "סמן כלא בוצע" : "סמן כבוצע"}
            >
              {i.done ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4 text-slate-300" />}
            </button>
            <span className={cn("flex-1 min-w-0 text-sm", i.done && "line-through text-muted-foreground")}>{i.text}</span>
            {i.done && i.done_by && !compact && <span className="text-[10px] text-muted-foreground shrink-0">{i.done_by}</span>}
            {mode === "edit" ? (
              <>
                <PlugaPicker value={i.pluga} onChange={(p) => onChange(items.map((x) => (x.id === i.id ? { ...x, pluga: p } : x)))} />
                <button type="button" onClick={() => onChange(items.filter((x) => x.id !== i.id))} className="text-muted-foreground hover:text-destructive shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              !pluga && i.pluga && (
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full shrink-0", PLUGA_COLORS[i.pluga]?.light)}>{i.pluga}</span>
              )
            )}
          </li>
        ))}
      </ul>

      {mode === "edit" && (
        <div className="flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="פריט חדש (למשל: מערכת הגברה)"
            className="h-9 flex-1"
          />
          <PlugaPicker value={itemPluga} onChange={setItemPluga} />
          <Button type="button" variant="outline" size="sm" onClick={add} disabled={!text.trim()} className="h-9 gap-1">
            <Plus className="w-3.5 h-3.5" /> הוסף
          </Button>
        </div>
      )}
    </div>
  );
}

function PlugaPicker({ value, onChange }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "text-[11px] px-2 py-1 rounded-full border shrink-0 flex items-center gap-1",
            value ? cn(PLUGA_COLORS[value]?.light, "border-transparent") : "bg-white text-muted-foreground"
          )}
        >
          {value ? (
            <>
              <span className={cn("w-1.5 h-1.5 rounded-full", PLUGA_COLORS[value]?.dot)} /> {value}
            </>
          ) : "ללא פלוגה"}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" dir="rtl">
        {PLUGOT.map((p) => (
          <DropdownMenuItem key={p} onSelect={() => onChange(p)}>
            <span className={cn("w-2.5 h-2.5 rounded-full ml-2", PLUGA_COLORS[p].dot)} /> {p}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onSelect={() => onChange(null)}>ללא פלוגה</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
