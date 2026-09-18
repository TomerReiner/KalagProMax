import React from "react";
import { cn } from "@/lib/utils";

const TONES = {
  slate: "bg-slate-100 text-slate-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  orange: "bg-orange-100 text-orange-700",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  emerald: "bg-emerald-100 text-emerald-700",
};

export default function StatCard({ label, value, tone = "slate", icon }) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", TONES[tone])}>
        {icon || <span className="text-lg font-bold">{value}</span>}
      </div>
      <div className="min-w-0">
        {icon && <p className="text-2xl font-bold leading-none">{value}</p>}
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}