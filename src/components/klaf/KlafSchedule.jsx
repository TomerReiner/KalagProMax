import React from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PLUGOT, PLUGA_COLORS, EVENT_COLORS } from "@/lib/constants";
import { computeLayout } from "@/lib/calendarLayout";

// "לוז יומי" on the Klaf page — the same day the constraints calendar shows
// (src/pages/Constraints.jsx): every constraint, event, recurring event and
// שוטף duty of the battalion, with the same colors (constraint = its
// pluga's color, several plugot = dark; event = grey; recurring = dashed;
// שוטף = dotted, in the assigned pluga's color). Built by
// dayScheduleBlocks() in src/lib/battalion.js. Whatever involves the
// viewer's own pluga gets a thick outline and a "שלך" tag. Tapping a block
// opens it on the constraints page.
const HOUR_START = 6;
const HOUR_END = 23;
const HOUR_HEIGHT = 40;

function timeToPx(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  const hours = h + m / 60;
  const clamped = Math.max(HOUR_START, Math.min(HOUR_END, hours));
  return (clamped - HOUR_START) * HOUR_HEIGHT;
}

function colorsFor(block) {
  if (block.type === "constraint") {
    if (block.plugot.length > 1) return { bg: "bg-slate-700", text: "text-white" };
    return PLUGA_COLORS[block.plugot[0]] || EVENT_COLORS;
  }
  if (block.type === "event") return EVENT_COLORS;
  return PLUGA_COLORS[block.plugot[0]] || EVENT_COLORS;
}

export default function KlafSchedule({ blocks, pluga, dateStr }) {
  const navigate = useNavigate();
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
  const totalHeight = (HOUR_END - HOUR_START) * HOUR_HEIGHT;

  if (!blocks || blocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border border-border rounded-xl bg-white">
        אין פעילות בלוז ליום הזה
      </div>
    );
  }

  const laid = blocks.map((b) => {
    const top = timeToPx(b.start);
    const crossesMidnight = b.end && b.end < b.start;
    const height = crossesMidnight ? Math.max(totalHeight - top, 40) : Math.max(timeToPx(b.end) - top, 20);
    return { id: b.key, top, height, block: b };
  });
  const layout = computeLayout(laid);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className={cn("w-3 h-3 rounded", EVENT_COLORS.bg)} />אירוע</span>
        <span className="flex items-center gap-1"><span className={cn("w-3 h-3 rounded border-2 border-dashed", EVENT_COLORS.bg)} />קבוע</span>
        <span className="flex items-center gap-1"><span className={cn("w-3 h-3 rounded border-2 border-dotted", EVENT_COLORS.bg)} />שוטף</span>
        {PLUGOT.map((p) => (
          <span key={p} className="flex items-center gap-1"><span className={cn("w-3 h-3 rounded", PLUGA_COLORS[p].bg)} />{p}</span>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="flex">
          <div className="w-12 shrink-0">
            {hours.map((h) => (
              <div key={h} className="text-xs text-muted-foreground text-center pt-1 border-b border-border/50" style={{ height: HOUR_HEIGHT }}>
                {h}:00
              </div>
            ))}
          </div>
          <div className="flex-1 relative" style={{ height: totalHeight }}>
            {hours.map((h, hi) => (
              <div key={hi} className="absolute w-full border-b border-border/30" style={{ top: hi * HOUR_HEIGHT }} />
            ))}
            {laid.map(({ id, top, height, block }) => {
              const { column, totalColumns } = layout.get(id) || { column: 0, totalColumns: 1 };
              const w = 100 / totalColumns;
              const colors = colorsFor(block);
              const mine = pluga && block.plugot.includes(pluga);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(block.eventId ? `/constraints?event=${block.eventId}` : `/constraints?date=${dateStr}`)}
                  className={cn(
                    "absolute rounded-md p-1.5 text-xs overflow-hidden shadow-sm text-right hover:opacity-90 transition-opacity",
                    colors.bg,
                    colors.text,
                    block.type === "recurring" && "border-2 border-dashed",
                    block.type === "shotaf" && "border-2 border-dotted",
                    mine && "ring-2 ring-offset-1 ring-black z-10"
                  )}
                  style={{ top, height, right: `calc(${column * w}% + 2px)`, width: `calc(${w}% - 4px)` }}
                  title={[block.title, block.subtitle, block.details].filter(Boolean).join(" · ")}
                >
                  <p className="opacity-75 text-[10px] font-medium truncate">
                    {mine && <span className="font-bold">שלך · </span>}
                    {block.subtitle}
                  </p>
                  <p className="font-semibold truncate">{block.title}</p>
                  <p className="opacity-80 text-[10px]">{block.start}{block.end ? ` - ${block.end}` : ""}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
