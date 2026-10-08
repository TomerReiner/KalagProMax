import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Share2, MessageCircle, Check } from "lucide-react";
import { toDateStr } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { BRIEF_SECTIONS, buildDailyBrief, addDays, dateOnly, recurringForDate } from "@/lib/battalion";
import { useToast } from "@/components/ui/use-toast";

// "בריף יומי" — the day's שוטף, events, tasks, meal regulators, constraints
// and fresh announcements as one WhatsApp-ready message. Today or tomorrow,
// pick which sections to include, tweak the text if needed, then copy /
// share (native share sheet on phones) / open straight in WhatsApp.
export default function DailyBriefDialog({ open, onClose, data }) {
  const { toast } = useToast();
  const [which, setWhich] = useState(0); // 0 = today, 1 = tomorrow
  const [sections, setSections] = useState(BRIEF_SECTIONS.map((s) => s.key));
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const generated = useMemo(() => {
    if (!data) return "";
    const date = addDays(new Date(), which);
    const ds = toDateStr(date);
    const twoDaysAgo = Date.now() - 2 * 86400000;
    return buildDailyBrief({
      date,
      routine: data.routines.find((r) => dateOnly(r.routine_date) === ds),
      events: data.events.filter((e) => dateOnly(e.event_date) === ds),
      recurring: recurringForDate(date, data.recurring, data.overrides),
      directTasks: data.directTasks.filter((t) => dateOnly(t.task_date) === ds),
      regulators: data.regulators.filter((r) => dateOnly(r.meal_date) === ds),
      constraints: data.constraints.filter((c) => dateOnly(c.constraint_date) === ds),
      announcements: which === 0 ? data.announcements.filter((a) => new Date(a.created_date).getTime() >= twoDaysAgo).slice(0, 3) : [],
      sections,
    });
  }, [data, which, sections]);

  useEffect(() => {
    setText(generated);
  }, [generated]);

  const toggle = (key) => setSections((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "לא הצלחתי להעתיק", variant: "destructive" });
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // user cancelled the share sheet
      }
    } else {
      copy();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>בריף יומי</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            {["היום", "מחר"].map((label, i) => (
              <button
                key={label}
                onClick={() => setWhich(i)}
                className={cn("px-4 py-1.5 rounded-md text-sm font-medium", which === i ? "bg-white shadow-sm" : "text-muted-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BRIEF_SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => toggle(s.key)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-colors",
                  sections.includes(s.key) ? "bg-slate-900 text-white border-slate-900" : "bg-white text-muted-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} className="text-sm leading-relaxed font-sans" dir="rtl" />
          <p className="text-[11px] text-muted-foreground">אפשר לערוך את הטקסט לפני השליחה. הכוכביות יופיעו כטקסט מודגש בוואטסאפ.</p>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={copy} className="gap-1.5">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? "הועתק" : "העתק"}
            </Button>
            <Button variant="outline" onClick={share} className="gap-1.5">
              <Share2 className="w-4 h-4" />
              שתף
            </Button>
            <Button asChild className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
                <MessageCircle className="w-4 h-4" />
                וואטסאפ
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
