import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Sparkles, ChevronDown, ArrowLeft, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreviewRole } from "@/lib/previewRoleContext";
import { canOpenPage } from "@/lib/rolePages";
import { openCommandPalette } from "@/components/CommandPalette";
import { WHATS_NEW, GUIDE_SECTIONS, SHORTCUTS } from "@/lib/guideContent";

// "מדריך ומה חדש" — what's new (with a "try it" link per feature) and a
// short how-to per topic, filtered by default to what the viewer's role can
// actually use. Content lives in src/lib/guideContent.js.
export default function Guide() {
  const [role, setRole] = useState(null);
  const { previewRole } = usePreviewRole();
  const [mineOnly, setMineOnly] = useState(true);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    base44.auth.me().then((u) => setRole(u.role)).catch(() => {});
  }, []);

  const effectiveRole = previewRole || role;
  const forMe = (item) => !item.roles || item.roles.includes(effectiveRole);
  const reachable = (to) => !to || canOpenPage(effectiveRole, to);
  const news = WHATS_NEW.filter(forMe);
  const sections = GUIDE_SECTIONS.filter((s) => !mineOnly || forMe(s));

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-bold">מה חדש</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {news.map((n) => {
            const Icon = n.icon;
            const action = n.to && reachable(n.to)
              ? <Link to={n.to} className="text-xs font-medium text-slate-900 hover:underline inline-flex items-center gap-0.5">נסו עכשיו <ArrowLeft className="w-3 h-3" /></Link>
              : !n.to
                ? <button onClick={openCommandPalette} className="text-xs font-medium text-slate-900 hover:underline inline-flex items-center gap-0.5">נסו עכשיו <ArrowLeft className="w-3 h-3" /></button>
                : null;
            return (
              <div key={n.title} className="bg-white border rounded-xl p-3 flex gap-3">
                <span className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{n.text}</p>
                  {action}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h2 className="text-lg font-bold">איך עושים את זה?</h2>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {[[true, "מה שרלוונטי אליי"], [false, "הכל"]].map(([v, label]) => (
              <button
                key={label}
                onClick={() => setMineOnly(v)}
                className={cn("px-3 py-1 rounded-md text-xs font-medium", mineOnly === v ? "bg-white shadow-sm" : "text-muted-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white border rounded-xl divide-y">
          {sections.map((s) => {
            const Icon = s.icon;
            const open = openId === s.id;
            return (
              <div key={s.id}>
                <button onClick={() => setOpenId(open ? null : s.id)} className="w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-slate-50">
                  <Icon className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="flex-1 text-sm font-medium">{s.title}</span>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="px-4 pb-4 pr-11 space-y-2">
                    <ol className="space-y-1.5 list-decimal pr-4 text-sm text-slate-700 leading-relaxed">
                      {s.steps.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                    {s.to && reachable(s.to) && (
                      <Link to={s.to} className="inline-flex items-center gap-1 text-xs font-medium text-slate-900 hover:underline">
                        לעמוד <ArrowLeft className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="hidden sm:block">
        <div className="flex items-center gap-2 mb-3">
          <Keyboard className="w-5 h-5 text-slate-500" />
          <h2 className="text-lg font-bold">קיצורי מקלדת</h2>
        </div>
        <div className="bg-white border rounded-xl divide-y">
          {SHORTCUTS.map((s) => (
            <div key={s.text} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>{s.text}</span>
              <span className="flex gap-1" dir="ltr">
                {s.keys.map((k) => <kbd key={k} className="rounded border bg-slate-50 px-1.5 py-0.5 text-xs">{k}</kbd>)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
