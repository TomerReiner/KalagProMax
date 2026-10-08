import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Check, ShieldCheck, Phone } from "lucide-react";
import { PLUGA_COLORS } from "@/lib/constants";
import { PERMISSION_LIST, hasPermission, plugotFor } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, formatPhone } from "@/lib/contacts";
import { useToast } from "@/components/ui/use-toast";

// What each role can do, in one plain sentence — shown under "ההרשאות שלי"
// so nobody has to guess why a button is or isn't there.
const ROLE_ABILITIES = {
  admin: "רואה ועורך הכל: משתמשים, הרשאות, משימות, שוטף, מחסנים והודעות.",
  קלפ: "מנהל את המשימות של הפלוגה, אילוצים, סיכומי מסדר ומשיכות ציוד לפלוגה.",
  רסר: "רואה את תמונת המצב הגדודית, פערים, אילוצים וסטטיסטיקה.",
  סגל: "רואה את תמונת המצב הגדודית, ומאשר הזמנות פלייבוקס.",
};

// "הפרופיל שלי" — who you are in the system (role, pluga), your phone
// number for "ספר קשר" (saved via set_my_phone, see base44Client.updateMe),
// and every special permission you hold, in plain language.
export default function MyProfileCard({ user, onUserChange, effectiveRole, delegatedPermissions }) {
  const { toast } = useToast();
  const [phone, setPhone] = useState(user.phone || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setPhone(user.phone || ""), [user.phone]);

  const dirty = (phone || "").replace(/[^0-9+]/g, "") !== (user.phone || "").replace(/[^0-9+]/g, "");

  const save = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ phone });
      onUserChange({ ...user, phone: phone.replace(/[^0-9+]/g, "") || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      toast({ title: "שגיאה בשמירת הטלפון", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const granted = PERMISSION_LIST.map((perm) => {
    if (perm.scoped) {
      const plugot = plugotFor(delegatedPermissions, perm.key);
      return plugot.length ? { perm, plugot } : null;
    }
    return hasPermission(delegatedPermissions, perm.key) ? { perm, plugot: [] } : null;
  }).filter(Boolean);

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="p-4 flex items-center gap-3 border-b">
        <span className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-bold shrink-0">
          {(user.full_name || user.email || "?").trim().charAt(0)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{user.full_name || user.email}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 font-medium">{ROLE_LABELS[effectiveRole] || effectiveRole}</span>
          {user.pluga && (
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", PLUGA_COLORS[user.pluga]?.light)}>{user.pluga}</span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-1.5 border-b">
        <label className="text-sm font-medium flex items-center gap-1.5"><Phone className="w-4 h-4 text-slate-500" /> מספר טלפון</label>
        <div className="flex gap-2">
          <Input
            type="tel"
            inputMode="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && dirty && save()}
            placeholder="05X-XXX-XXXX"
            className="text-right"
          />
          <Button onClick={save} disabled={!dirty || saving} className="gap-1.5 shrink-0">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
            {saved ? "נשמר" : "שמור"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {user.phone ? `מופיע ב"ספר קשר" כ-${formatPhone(user.phone)} — אפשר להתקשר או לשלוח וואטסאפ בלחיצה.` : 'יופיע ב"ספר קשר" כדי שיוכלו להתקשר אליך בלחיצה.'}
        </p>
      </div>

      <div className="p-4 space-y-2">
        <p className="text-sm font-medium flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-slate-500" /> ההרשאות שלי</p>
        <p className="text-xs text-muted-foreground">{ROLE_ABILITIES[effectiveRole]}</p>
        {effectiveRole === "admin" ? (
          <p className="text-xs rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-900 px-3 py-2">
            כמנהל/ת מערכת יש לך אוטומטית את כל {PERMISSION_LIST.length} ההרשאות המיוחדות, לכל הפלוגות.
          </p>
        ) : granted.length > 0 ? (
          <ul className="space-y-1.5">
            {granted.map(({ perm, plugot }) => (
              <li key={perm.key} className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                <p className="text-sm font-medium text-emerald-900">
                  {perm.label}
                  {plugot.length > 0 && <span className="text-xs font-normal text-emerald-700"> · {plugot.join(", ")}</span>}
                </p>
                <p className="text-[11px] text-emerald-800/80">{perm.description}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">אין הרשאות מיוחדות מעבר לתפקיד. אדמין יכול להעניק דרך תפריט הניהול.</p>
        )}
      </div>
    </div>
  );
}
