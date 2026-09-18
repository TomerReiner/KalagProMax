import React from "react";
import { cn } from "@/lib/utils";
import { PLUGA_COLORS, EVENT_COLORS } from "@/lib/constants";
import { computeLayout } from "@/lib/calendarLayout";

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

export default function KlafSchedule({ items, pluga }) {
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
  const totalHeight = (HOUR_END - HOUR_START) * HOUR_HEIGHT;
  const plugaColor = PLUGA_COLORS[pluga] || EVENT_COLORS;

  if (!items || items.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border border-border rounded-xl bg-white">
        אין משימות עם שעות בלוז
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="flex">
        <div className="w-12 shrink-0">
          {hours.map((h) => (
            <div
              key={h}
              className="text-xs text-muted-foreground text-center pt-1 border-b border-border/50"
              style={{ height: HOUR_HEIGHT }}
            >
              {h}:00
            </div>
          ))}
        </div>
        <div className="flex-1 relative" style={{ height: totalHeight }}>
          {hours.map((h, hi) => (
            <div
              key={hi}
              className="absolute w-full border-b border-border/30"
              style={{ top: hi * HOUR_HEIGHT }}
            />
          ))}
          {(() => {
            const blocks = items.map((item, i) => {
              const top = timeToPx(item.start_time);
              const isCrossMidnight = item.end_time && item.end_time < item.start_time;
              const height = isCrossMidnight
                ? Math.max(totalHeight - top, 40)
                : Math.max(timeToPx(item.end_time) - top, 20);
              return { id: `item-${i}`, top, height, item };
            });
            const layout = computeLayout(blocks);
            return blocks.map((block, i) => {
              const { column, totalColumns } = layout.get(block.id) || { column: 0, totalColumns: 1 };
              const w = 100 / totalColumns;
              const colors = block.item.type === "event" ? EVENT_COLORS : plugaColor;
              return (
                <div
                  key={i}
                  className={cn(
                    "absolute rounded-md p-1.5 text-xs overflow-hidden shadow-sm",
                    colors.bg,
                    colors.text
                  )}
                  style={{
                    top: block.top,
                    height: block.height,
                    right: `calc(${column * w}% + 2px)`,
                    width: `calc(${w}% - 4px)`,
                  }}
                >
                  <p className="font-semibold truncate">{block.item.title}</p>
                  <p className="opacity-80 text-[10px]">
                    {block.item.start_time}{block.item.end_time ? ` - ${block.item.end_time}` : ""}
                  </p>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}