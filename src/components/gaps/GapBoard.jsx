import React, { useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Pencil, Trash2, MapPin, Clock, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLUGA_COLORS } from "@/lib/constants";
import { daysSince } from "@/components/gaps/GapCard";

// A Jira-style board: one column per status, cards dragged between columns to
// change status. Column order (right-to-left, matching the app's RTL layout)
// mirrors a normal kanban flow: טרם הועלה (To Do) → בטיפול (In Progress) →
// טופל (Done). There is no separate "archive" concept here — unlike the list
// view, the board always shows every status side by side (that IS the board),
// so a "Done" card just lives in its own column instead of being tucked away.
const COLUMNS = [
  { status: "טרם הועלה", dot: "bg-amber-400", header: "bg-amber-50 border-amber-200", border: "border-amber-300" },
  { status: "בטיפול", dot: "bg-blue-400", header: "bg-blue-50 border-blue-200", border: "border-blue-300" },
  { status: "טופל", dot: "bg-emerald-400", header: "bg-emerald-50 border-emerald-200", border: "border-emerald-300" },
];

const PRIORITY_STYLES = {
  "נמוך": "bg-slate-100 text-slate-600",
  "בינוני": "bg-sky-100 text-sky-700",
  "גבוה": "bg-orange-100 text-orange-700",
  "קריטי": "bg-red-100 text-red-700 ring-1 ring-red-200",
};

export default function GapBoard({ gaps, onDragEnd, onEdit, onDelete, onClick, staleDays = 7 }) {
  const byStatus = useMemo(() => {
    const map = { "טרם הועלה": [], "בטיפול": [], "טופל": [] };
    gaps.forEach((g) => {
      (map[g.status] || map["טרם הועלה"]).push(g);
    });
    return map;
  }, [gaps]);

  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    // Reordering within the same column has nothing to persist (card order
    // isn't a stored field — it's driven by the sort dropdown), so only a
    // move to a different column (= status change) does anything.
    if (source.droppableId === destination.droppableId) return;
    onDragEnd(draggableId, source.droppableId, destination.droppableId);
  };

  return (
    // Outer frame around the whole board — makes it read as its own distinct
    // section of the page (thick border + card background + shadow) rather
    // than columns floating loose directly against the page background.
    <div className="rounded-2xl border-2 border-slate-300 bg-white p-3 shadow-sm">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-2 items-start" dir="rtl">
          {COLUMNS.map((col) => {
            const items = byStatus[col.status] || [];
            return (
              // Each column also gets its own thicker, status-colored border
              // (instead of a generic thin gray one) so the columns read as
              // clearly separate lists, the way Jira's board does.
              <div key={col.status} className={cn("w-[300px] shrink-0 flex flex-col bg-slate-50 rounded-xl border-2", col.border)}>
                <div className={cn("flex items-center gap-2 px-3 py-2.5 rounded-t-[10px] border-b-2", col.header)}>
                  <span className={cn("w-2.5 h-2.5 rounded-full", col.dot)} />
                  <p className="text-sm font-semibold flex-1">{col.status}</p>
                  <span className="text-xs font-medium bg-white/70 rounded-full px-2 py-0.5">{items.length}</span>
                </div>
                <Droppable droppableId={col.status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex-1 p-2 space-y-2 min-h-[140px] transition-colors rounded-b-[10px]",
                        snapshot.isDraggingOver && "bg-slate-100"
                      )}
                    >
                      {items.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">אין פערים</p>
                      )}
                      {items.map((gap, index) => {
                        const days = daysSince(gap.updated_date);
                        const isStale = days != null && days >= staleDays && gap.status !== "טופל";
                        const plugaColor = PLUGA_COLORS[gap.company] || {};
                        return (
                          <Draggable key={gap.id} draggableId={gap.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                onClick={() => onClick?.(gap)}
                                className={cn(
                                  "bg-white rounded-lg border border-border p-3 space-y-2 cursor-pointer shadow-sm hover:shadow-md transition-shadow border-r-4",
                                  plugaColor.border || "border-r-slate-300",
                                  dragSnapshot.isDragging && "shadow-lg ring-2 ring-blue-300",
                                  isStale && "ring-2 ring-amber-300/70"
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", PRIORITY_STYLES[gap.priority])}>
                                    {gap.priority}
                                  </span>
                                  <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button type="button" onClick={() => onEdit(gap)} className="p-1 rounded hover:bg-slate-100 text-slate-500">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button type="button" onClick={() => onDelete(gap)} className="p-1 rounded hover:bg-red-50 text-red-500">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-sm font-medium leading-snug line-clamp-3">{gap.gap}</p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                  {gap.company && (
                                    <span className="flex items-center gap-1">
                                      <span className={cn("w-2 h-2 rounded-full", plugaColor.dot)} />
                                      {gap.company}
                                    </span>
                                  )}
                                  {gap.location && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {gap.location}
                                    </span>
                                  )}
                                  {gap.attachments?.length > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Paperclip className="w-3 h-3" />
                                      {gap.attachments.length}
                                    </span>
                                  )}
                                </div>
                                {isStale && (
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 inline-flex items-center gap-1 w-fit">
                                    <Clock className="w-3 h-3" />
                                    לא עודכן {days} ימים
                                  </span>
                                )}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
