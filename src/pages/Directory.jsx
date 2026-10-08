import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Phone, MessageCircle, Mail, Copy, Check, UserRound, ChevronLeft } from "lucide-react";
import { PLUGOT, PLUGA_COLORS } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { telHref, whatsappHref, formatPhone, ROLE_LABELS } from "@/lib/contacts";
import { canOpenPage } from "@/lib/rolePages";
import { usePreviewRole } from "@/lib/previewRoleContext";

// "ספר קשר" — who to call for what. Three views of the same people:
//  1. "מי אחראי על מה" — the holder(s) of each battalion-wide responsibility
//     (מווסתים, משיכות ציוד, פלייבוקס, שוטף), derived live from the same
//     user_permissions rows that grant the access, so it can't go stale.
//  2. קל"פים by pluga, color-coded.
//  3. סגל, רס"ר and admins.
// Every person: tap-to-call, WhatsApp, e-mail, copy number. Phones come from
// profiles.phone, which each user sets for themselves in "אזור אישי".
const RESPONSIBILITIES = [
  { key: "meal_regulators_manager", what: "מווסתים לארוחות" },
  { key: "equipment_manager", what: "מחסנים ומשיכות ציוד" },
  { key: "playbox_orders", what: "הזמנות פלייבוקס", includeRole: "סגל" },
  { key: "shotaf_schedule", what: "שיבוץ שוטף" },
];

export default function Directory() {
  const [me, setMe] = useState(null);
  const [profiles, setProfiles] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [query, setQuery] = useState("");
  const { previewRole } = usePreviewRole();

  useEffect(() => {
    const safe = (p) => p.catch(() => []);
    Promise.all([
      base44.auth.me().catch(() => null),
      safe(base44.entities.User.list()),
      safe(base44.entities.UserPermission.list()),
      safe(base44.entities.EquipmentSettings.list()),
    ]).then(([meData, profileData, permData, settingsData]) => {
      setMe(meData);
      // The signed-in user's own row may be fresher (e.g. a phone just set).
      setProfiles(profileData.filter((p) => p.role).map((p) => (meData && p.id === meData.id ? { ...p, ...meData } : p)));
      setPermissions(permData);
      setSettings(settingsData[0] || null);
    });
  }, []);

  const q = query.trim();
  const matches = (p) => !q || `${p.full_name || ""} ${p.email || ""} ${p.pluga || ""} ${ROLE_LABELS[p.role] || ""} ${p.phone || ""}`.includes(q);

  const responsible = useMemo(() => {
    if (!profiles) return [];
    return RESPONSIBILITIES.map((r) => {
      const ids = new Set(permissions.filter((x) => x.permission === r.key).map((x) => x.user_id));
      if (r.key === "equipment_manager" && settings?.responsible_klaf_id) ids.add(settings.responsible_klaf_id);
      const people = profiles.filter((p) => ids.has(p.id) || (r.includeRole && p.role === r.includeRole));
      return { ...r, label: PERMISSIONS[r.key]?.label, people };
    });
  }, [profiles, permissions, settings]);

  if (!profiles) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canOverview = canOpenPage(previewRole || me?.role, "/overview");
  const admins = profiles.filter((p) => p.role === "admin");
  const staff = profiles.filter((p) => p.role === "סגל" || p.role === "רסר");
  const missingPhone = me && !me.phone;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש לפי שם, פלוגה, תפקיד או טלפון..." className="pr-9 h-11" />
      </div>

      {missingPhone && (
        <Link to="/personal" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm hover:bg-amber-100/60">
          <Phone className="w-4 h-4 text-amber-700 shrink-0" />
          <span className="flex-1">עוד לא הוספת מספר טלפון — בלי זה לא יוכלו להתקשר אליך מכאן.</span>
          <span className="text-amber-800 font-medium flex items-center gap-0.5">להוספה <ChevronLeft className="w-4 h-4" /></span>
        </Link>
      )}

      {!q && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">מי אחראי על מה</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {responsible.map((r) => (
              <div key={r.key} className="bg-white border rounded-xl p-3">
                <p className="text-xs text-muted-foreground">{r.what}</p>
                {r.people.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-1">לא הוגדר — אדמין יכול למנות בתפריט הניהול</p>
                ) : (
                  <div className="mt-1 space-y-1">
                    {r.people.map((p) => <PersonRow key={p.id} person={p} compact />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">קל"פים לפי פלוגה</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PLUGOT.map((pluga) => {
            const people = profiles.filter((p) => p.role === "קלפ" && p.pluga === pluga && matches(p));
            if (q && !people.length && !pluga.includes(q)) return null;
            const color = PLUGA_COLORS[pluga];
            return (
              <div key={pluga} className="bg-white border rounded-xl overflow-hidden">
                <div className={cn("px-3 py-2 flex items-center justify-between", color.light)}>
                  <span className="font-bold text-sm flex items-center gap-1.5"><span className={cn("w-2.5 h-2.5 rounded-full", color.dot)} />{pluga}</span>
                  {canOverview && (
                    <Link to={`/overview?pluga=${encodeURIComponent(pluga)}`} className="text-[11px] text-slate-600 hover:text-slate-900">תמונת מצב</Link>
                  )}
                </div>
                <div className="p-2 space-y-1">
                  {people.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1 py-1">אין קל"פ רשום</p>
                  ) : (
                    people.map((p) => <PersonRow key={p.id} person={p} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {[["סגל ורס\"ר", staff], ["ניהול המערכת", admins]].map(([title, list]) => {
        const shown = list.filter(matches);
        if (!shown.length) return null;
        return (
          <section key={title}>
            <h2 className="text-sm font-semibold text-slate-700 mb-2">{title}</h2>
            <div className="bg-white border rounded-xl p-2 grid gap-1 sm:grid-cols-2">
              {shown.map((p) => <PersonRow key={p.id} person={p} showRole />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PersonRow({ person, compact, showRole }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(person.phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };
  const tel = telHref(person.phone);
  const wa = whatsappHref(person.phone);
  return (
    <div className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50">
      <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 text-xs font-bold">
        {(person.full_name || person.email || "?").trim().charAt(0) || <UserRound className="w-4 h-4" />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {person.full_name || person.email}
          {(showRole || compact) && (
            <span className="text-[11px] text-muted-foreground font-normal mr-1">
              · {ROLE_LABELS[person.role] || person.role}{person.pluga ? ` ${person.pluga}` : ""}
            </span>
          )}
        </p>
        {!compact && (
          <p className="text-[11px] text-muted-foreground truncate" dir="ltr" style={{ textAlign: "right" }}>
            {person.phone ? formatPhone(person.phone) : "אין טלפון"}
          </p>
        )}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {tel && (
          <a href={tel} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title={`חיוג ל-${formatPhone(person.phone)}`}>
            <Phone className="w-4 h-4" />
          </a>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50" title="וואטסאפ">
            <MessageCircle className="w-4 h-4" />
          </a>
        )}
        {person.phone && !compact && (
          <button onClick={copy} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" title="העתק מספר">
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        )}
        {person.email && (
          <a href={`mailto:${person.email}`} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" title={person.email}>
            <Mail className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}
