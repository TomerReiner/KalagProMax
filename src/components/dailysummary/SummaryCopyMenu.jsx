import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Copy, ChevronDown } from "lucide-react";
import { PLUGA_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { plugotIn, summaryText } from "@/lib/dailySummary";

// Copy a day's סיכום מסדר — the whole thing, or just one pluga's part.
// `myPluga` (the viewer's own pluga, e.g. a קל"פ) gets its own one-tap
// button when that pluga appears on the summary.
export default function SummaryCopyMenu({ date, entries, myPluga }) {
  const { toast } = useToast();
  const plugot = plugotIn(entries);

  const copy = async (pluga) => {
    try {
      await navigator.clipboard.writeText(summaryText(date, entries, pluga));
      toast({ title: pluga ? `החלק של ${pluga} הועתק` : "הסיכום הועתק", duration: 2000 });
    } catch {
      toast({ title: "שגיאה בהעתקה", variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {myPluga && plugot.includes(myPluga) && (
        <Button size="sm" variant="outline" onClick={() => copy(myPluga)} className={cn("gap-1.5 border-transparent", PLUGA_COLORS[myPluga]?.light)}>
          <Copy className="w-3.5 h-3.5" />
          העתק את החלק של {myPluga}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1">
            <Copy className="w-3.5 h-3.5" />
            העתק
            <ChevronDown className="w-3 h-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" dir="rtl">
          <DropdownMenuItem onSelect={() => copy(null)}>כל הסיכום</DropdownMenuItem>
          {plugot.length > 0 && <DropdownMenuSeparator />}
          {plugot.map((p) => (
            <DropdownMenuItem key={p} onSelect={() => copy(p)}>
              <span className={cn("w-2.5 h-2.5 rounded-full ml-2", PLUGA_COLORS[p]?.dot)} />
              רק החלק של {p}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
