import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Truck, Plus, Trash2, Shield } from "lucide-react";
import { PLUGOT, PLUGA_COLORS, toDateStr } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { hasPermission } from "@/lib/permissions";

const STATUS_LABELS = { "ממתין": "ממתין", "הוזמן": "הוזמן", "בוטל": "בוטל" };

// Standalone page for the playbox_orders delegated permission (see
// src/lib/permissions.js and supabase/migrations/0005_delegated_permissions.sql).
// Org-wide, not per-pluga: whoever is granted this sees every pluga's
// consolidated weekly order requests here, regardless of their role.
export default function Playbox() {
  const [user, setUser] = useState(null);
  const [myPermissions, setMyPermissions] = useState([]);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    base44.entities.UserPermission.filter({ user_id: user.id })
      .then(setMyPermissions)
      .catch(() => setMyPermissions([]))
      .finally(() => setChecking(false));
  }, [user?.id]);

  if (!user || checking) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasPermission(myPermissions, "playbox_orders")) {
    return (
      <div className="text-center py-20 text-muted-foreground space-y-2">
        <Shield className="w-10 h-10 mx-auto opacity-40" />
        <p className="text-sm font-medium">אין לך הרשאה לעמוד זה</p>
        <p className="text-xs">אדמין יכול להעניק הרשאה דרך "ניהול משתמשים ובקשות גישה" → משתמשים</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-center gap-2">
        <Truck className="w-5 h-5 text-slate-500" />
        <h1 className="text-xl font-bold">פלייבוקס</h1>
      </div>
      <PlayboxOrders />
    </div>
  );
}

// ---------------------------------------------------------------------------
// פלייבוקס — ריכוז בקשות הזמנה מכל הפלוגות (ported from the former
// Delegations.jsx PlayboxTab, unchanged in behavior).
// ---------------------------------------------------------------------------
function PlayboxOrders() {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ pluga: PLUGOT[0], order_date: toDateStr(new Date()), item: "", quantity: 1, notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await base44.entities.PlayboxOrder.list("-order_date", 200);
      setOrders(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = base44.entities.PlayboxOrder.subscribe(() => load());
    return unsubscribe;
  }, [load]);

  const handleAdd = async () => {
    if (!form.item.trim()) return;
    setSaving(true);
    try {
      await base44.entities.PlayboxOrder.create({
        pluga: form.pluga,
        order_date: form.order_date,
        item: form.item.trim(),
        quantity: Number(form.quantity) || 1,
        notes: form.notes.trim() || null,
        status: "ממתין",
      });
      setForm((f) => ({ ...f, item: "", quantity: 1, notes: "" }));
      await load();
      toast({ title: "ההזמנה נוספה", duration: 2000 });
    } catch (err) {
      toast({ title: "שגיאה בהוספת ההזמנה", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (order, status) => {
    try {
      await base44.entities.PlayboxOrder.update(order.id, { status });
      await load();
    } catch (err) {
      toast({ title: "שגיאה בעדכון הסטטוס", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (order) => {
    try {
      await base44.entities.PlayboxOrder.delete(order.id);
      await load();
    } catch (err) {
      toast({ title: "שגיאה במחיקה", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-3 bg-white space-y-2">
        <p className="text-sm font-medium">הוספת בקשת הזמנה</p>
        <div className="grid grid-cols-2 gap-2">
          <Select value={form.pluga} onValueChange={(v) => setForm((f) => ({ ...f, pluga: v }))}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLUGOT.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={form.order_date} onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))} className="h-9 text-sm" />
        </div>
        <Input placeholder="פריט" value={form.item} onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))} className="h-9 text-sm" />
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} className="h-9 text-sm" />
          <Input placeholder="הערות (אופציונלי)" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="h-9 text-sm" />
        </div>
        <Button size="sm" onClick={handleAdd} disabled={saving || !form.item.trim()} className="w-full gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          הוסף
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : orders.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">אין בקשות הזמנה עדיין</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="border rounded-lg p-3 bg-white flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", PLUGA_COLORS[o.pluga]?.light)}>{o.pluga}</span>
                  <span className="text-sm font-medium">{o.item} × {o.quantity}</span>
                </div>
                <p className="text-xs text-muted-foreground">{o.order_date}{o.notes ? ` · ${o.notes}` : ""}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Select value={o.status} onValueChange={(v) => handleStatus(o, v)}>
                  <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(STATUS_LABELS).map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(o)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
