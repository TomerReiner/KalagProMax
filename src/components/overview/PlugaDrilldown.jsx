import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Mail, Phone, CheckCircle2, Circle, HardHat, Package, CalendarX2, UtensilsCrossed, ChevronLeft } from "lucide-react";
import { PLUGOT, PLUGA_COLORS, toDateStr, formatHebrewDate } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { plugaTasksForDay, completionKeySet, constraintPlugot, dateOnly, daysFrom, daysOverdue } from "@/lib/battalion";
import { SectionTitle } from "./OverviewSections";

const PRIORITY_STYLE = { "קריטי": "bg-red-100 text-red-700", "גבוה": "bg-orange-100 text-orange-700", "בינוני": "bg-sky-100 text-sky-700", "נמוך": "bg-slate-100 text-slate-600" };
const DAY_SHORT = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// One pluga, end to end — the battalion → company drill-down of "תמונת מצב":
// who its קל"פ is, its whole week of duties (with today's completion when
// visible to this role), its open gaps, the equipment it's holding, its
// constraints and today's meal regulators.
export default function PlugaDrilldown({ data, pluga, onSelect, showCompletion }) {
  const color = PLUGA_COLORS[pluga];
  const week = daysFrom(new Date(), 7);
  const done = completionKeySet(data.completions);
  const todayStr = toDateStr(new Date());
  const klafs = data.profiles.filter((p) => p.role === "קלפ" && p.pluga === pluga);
  const gaps = data.gaps
    .filter((g) => g.company === pluga && g.status !== "טופל")
    .sort((a, b) => ["קריטי", "גבוה", "בינוני", "נמוך"].indexOf(a.priority) - ["קריטי", "גבוה", "בינוני", "נמוך"].indexOf(b.priority));
  const holdings = data.holdings.filter((h) => h.pluga === pluga);
  const constraints = data.constraints
    .filter((c) => constraintPlugot(c).includes(pluga))
    .sort((a, b) => `${dateOnly(a.constraint_date)}${a.start_time}`.localeCompare(`${dateOnly(b.constraint_date)}${b.start_time}`));
  const regulators = data.regulators.filter((r) => r.pluga === pluga && dateOnly(r.meal_date) === todayStr);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => onSelect(null)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="w-4 h-4" /> כל הגדוד
        </button>
        <div className="flex gap-1 flex-wrap mr-auto">
          {PLUGOT.map((p) => (
            <button
              key={p}
              onClick={() => onSelect(p)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                p === pluga ? cn(PLUGA_COLORS[p].bg, PLUGA_COLORS[p].text, "border-transparent") : "bg-white text-slate-600"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("rounded-2xl border-2 p-4", color.light, color.border)}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-black">{pluga}</h2>
            <p className="text-xs text-slate-600 mt-0.5">תמונת מצב פלוגתית · {formatHebrewDate(new Date())}</p>
          </div>
          <div className="space-y-1">
            {klafs.length === 0 && <p className="text-xs text-slate-600">אין קל"פ רשום לפלוגה</p>}
            {klafs.map((k) => (
              <div key={k.id} className="flex items-center gap-2 text-sm bg-white/70 rounded-lg px-2.5 py-1">
                <span className="font-medium">{k.full_name || k.email}</span>
                <span className="text-[10px] text-muted-foreground">קל"פ</span>
                {k.phone && (
                  <a href={`tel:${k.phone}`} className="text-blue-600" title={k.phone}><Phone className="w-3.5 h-3.5" /></a>
                )}
                {k.email && (
                  <a href={`mailto:${k.email}`} className="text-slate-500" title={k.email}><Mail className="w-3.5 h-3.5" /></a>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <Stat icon={CheckCircle2} label="משימות היום" value={(() => {
            const t = plugaTasksForDay(pluga, new Date(), {
              routine: data.routines.find((r) => dateOnly(r.routine_date) === todayStr),
              events: data.events.filter((e) => dateOnly(e.event_date) === todayStr),
              directTasks: data.directTasks.filter((d) => dateOnly(d.task_date) === todayStr),
            });
            return showCompletion ? `${t.filter((x) => done.has(x.key)).length}/${t.length}` : t.length;
          })()} />
          <Stat icon={HardHat} label="פערים פתוחים" value={gaps.length} />
          <Stat icon={Package} label="ציוד בידי הפלוגה" value={holdings.length} />
          <Stat icon={CalendarX2} label="אילוצים השבוע" value={constraints.length} />
        </div>
      </div>

      <section>
        <SectionTitle>השבוע של {pluga}</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {week.map(({ date, dateStr }, i) => {
            const tasks = plugaTasksForDay(pluga, date, {
              routine: data.routines.find((r) => dateOnly(r.routine_date) === dateStr),
              events: data.events.filter((e) => dateOnly(e.event_date) === dateStr),
              directTasks: data.directTasks.filter((d) => dateOnly(d.task_date) === dateStr),
            });
            if (!tasks.length && i > 0) return null;
            return (
              <div key={dateStr} className={cn("bg-white border rounded-xl p-3", i === 0 && "ring-2 ring-slate-900")}>
                <p className="text-xs font-semibold mb-1.5">{i === 0 ? "היום" : i === 1 ? "מחר" : `יום ${DAY_SHORT[date.getDay()]}`} <span className="text-muted-foreground font-normal">{date.getDate()}.{date.getMonth() + 1}</span></p>
                {tasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">אין משימות</p>
                ) : (
                  <ul className="space-y-1">
                    {tasks.map((t) => {
                      const isDone = i === 0 && showCompletion && done.has(t.key);
                      return (
                        <li key={t.key} className={cn("flex items-start gap-1.5 text-xs", isDone && "text-muted-foreground line-through")}>
                          {i === 0 && showCompletion ? (
                            isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-px" /> : <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-px" />
                          ) : (
                            <span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", color.dot)} />
                          )}
                          <span className="flex-1">{t.label}</span>
                          {t.time && <span className="text-muted-foreground tabular-nums" dir="ltr">{t.time}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <SectionTitle aside={<Link to="/" className="text-xs text-muted-foreground hover:text-foreground">לכל הפערים</Link>}>פערים פתוחים</SectionTitle>
          {gaps.length === 0 ? (
            <p className="text-sm text-muted-foreground bg-white border rounded-xl p-3">אין פערים פתוחים 🎉</p>
          ) : (
            <div className="bg-white border rounded-xl divide-y">
              {gaps.slice(0, 8).map((g) => (
                <Link key={g.id} to={`/?gap=${g.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full shrink-0", PRIORITY_STYLE[g.priority])}>{g.priority}</span>
                  <span className="text-sm flex-1 truncate">{g.gap}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{g.status}</span>
                  <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle>ציוד בידי הפלוגה</SectionTitle>
          {holdings.length === 0 ? (
            <p className="text-sm text-muted-foreground bg-white border rounded-xl p-3">הפלוגה לא מחזיקה ציוד מהמחסנים</p>
          ) : (
            <div className="bg-white border rounded-xl divide-y">
              {holdings.map((h) => {
                const late = h.expected_return_date ? daysOverdue(h.expected_return_date) : 0;
                return (
                  <div key={h.id} className="flex items-center gap-2 px-3 py-2">
                    <Package className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-sm flex-1 truncate">{h.item_name} ×{h.quantity} <span className="text-xs text-muted-foreground">· {h.warehouse}</span></span>
                    {late > 0 ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">באיחור {late} ימים</span>
                    ) : h.expected_return_date ? (
                      <span className="text-[10px] text-muted-foreground shrink-0">עד {h.expected_return_date}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <SectionTitle>אילוצים השבוע</SectionTitle>
          {constraints.length === 0 ? (
            <p className="text-sm text-muted-foreground bg-white border rounded-xl p-3">אין אילוצים</p>
          ) : (
            <div className="bg-white border rounded-xl divide-y">
              {constraints.map((c) => (
                <Link key={c.id} to={`/constraints?date=${dateOnly(c.constraint_date)}`} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                  <CalendarX2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm flex-1 truncate">{c.title}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{formatHebrewDate(dateOnly(c.constraint_date)).replace("יום ", "")} · {c.start_time}–{c.end_time}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle aside={<Link to="/meal-regulators" className="text-xs text-muted-foreground hover:text-foreground">לדף המווסתים</Link>}>מווסתים היום</SectionTitle>
          {regulators.length === 0 ? (
            <p className="text-sm text-muted-foreground bg-white border rounded-xl p-3">טרם מולאו מווסתים להיום</p>
          ) : (
            <div className="bg-white border rounded-xl divide-y">
              {regulators.map((r) => (
                <div key={r.id} className="px-3 py-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-slate-400" /> {r.meal_type}
                    {r.entry_time && <span className="text-muted-foreground font-normal">· כניסה {r.entry_time}</span>}
                  </p>
                  <p className="text-sm mt-0.5">{(r.regulators || []).map((x) => x.name).join(", ") || "—"}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="bg-white/80 rounded-xl px-3 py-2">
      <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
