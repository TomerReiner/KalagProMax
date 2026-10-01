import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Truck, Plus, Trash2, Shield, Sparkles, PackageCheck, Warehouse, Copy, Pencil, CheckCircle2, Circle } from "lucide-react";
import { PLUGA_COLORS, WAREHOUSES, toDateStr } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { hasPermission, effectivePermissions } from "@/lib/permissions";
import { usePreviewRole } from "@/lib/previewRoleContext";

// "התקבל" (received) is deliberately separate from "הוזמן" (ordered) — see
// supabase/migrations/0009_playbox_orders_received_status.sql. Placing the
// order and it actually arriving are two different events; only the second
// one should credit stock back (handleReceive below), so folding them into
// one status would either credit stock too early or need a second signal
// anyway. "אושר" (approved) is a THIRD, independent concept on top of status
// (see supabase/migrations/0018_warehouse_rename_and_playbox_order_approval.sql)
// — feature request: anyone with playbox_orders can approve any order, and
// editing an order clears its approval so it has to be re-approved.
const STATUS_LABELS = { "ממתין": "ממתין", "הוזמן": "הוזמן", "התקבל": "התקבל", "בוטל": "בוטל" };
const STATUS_BADGE_STYLE = {
  "ממתין": "bg-slate-100 text-slate-600",
  "הוזמן": "bg-blue-100 text-blue-700",
  "התקבל": "bg-green-100 text-green-700",
  "בוטל": "bg-red-100 text-red-600",
};

// One order as a single plain-text line, ready to paste anywhere (WhatsApp,
// an email, ...). Used both for the per-order copy button below and, joined
// into a bulleted block, for the "copy all pending" button. pluga is
// optional now (see supabase/migrations/0013_playbox_orders_optional_pluga.sql)
// — most orders won't have one — so it's only included when set.
function formatOneOrderAsText(order) {
  const title = order.name ? `${order.name}: ` : "";
  return `${title}${order.item} × ${order.quantity}${order.pluga ? ` (${order.pluga})` : ""}${order.notes ? ` - ${order.notes}` : ""}`;
}

// Formats several orders as one plain-text block. Used both here (all
// pending orders at once) and by WithdrawalForm.jsx (just the completion
// order(s) it created) — same convention, kept in sync manually since
// there's no shared UI-utility module yet for the two pages to import from.
function formatOrdersAsText(orders) {
  const lines = orders.map((o) => `• ${formatOneOrderAsText(o)}`);
  return `הזמנות פלייבוקס ממתינות (${orders.length}):\n${lines.join("\n")}`;
}

// Standalone page for the playbox_orders delegated permission (see
// src/lib/permissions.js and supabase/migrations/0005_delegated_permissions.sql).
// Org-wide, not per-pluga: whoever is granted this sees every pluga's
// consolidated weekly order requests here, regardless of their role. Every
// סגל holder has this by default now, with no explicit grant needed (see
// effectivePermissions in src/lib/permissions.js).
//
// This used to have a second tab — "מלאי ומעקב חוסרים"
// (supabase/migrations/0008_playbox_stock_tracking.sql, per-pluga target vs.
// current quantity per playbox_items row) — removed because the premise
// didn't hold: this equipment isn't any one pluga's own supply to track
// separately, it's shared across all of them, exactly like
// warehouse_items.target_quantity already models for physical equipment
// (see supabase/migrations/0012_warehouse_item_target_quantity.sql and
// Equipment.jsx's own "צור הזמנות בפלייבוקס לכל החוסרים"). The
// playbox_items table itself, and its data, are left in place rather than
// dropped — nothing reads or writes it anymore, matching how
// profiles.equipment_manager and src/pages/Delegations.jsx were retired
// elsewhere in this app.
export default function Playbox() {
  const [user, setUser] = useState(null);
  const [myPermissions, setMyPermissions] = useState([]);
  const [checking, setChecking] = useState(true);
  const { previewRole } = usePreviewRole();

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

  // previewRole-aware — see the doc comment on effectivePermissions in
  // src/lib/permissions.js (a true role preview should reflect a plain
  // member of that role, not always the real signed-in admin's full access).
  const effectiveRole = previewRole || user.role;
  if (!hasPermission(effectivePermissions(myPermissions, effectiveRole), "playbox_orders")) {
    return (
      <div className="text-center py-20 text-muted-foreground space-y-2">
        <Shield className="w-10 h-10 mx-auto opacity-40" />
        <p className="text-sm font-medium">אין לך הרשאה לעמוד זה</p>
        <p className="text-xs">אדמין יכול להעניק הרשאה דרך "ניהול משתמשים ובקשות גישה" → משתמשים (לאנשי סגל יש גישה כברירת מחדל)</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-center gap-2">
        <Truck className="w-5 h-5 text-slate-500" />
        <h1 className="text-xl font-bold">פלייבוקס</h1>
      </div>
      <PlayboxOrders user={user} />
    </div>
  );
}

const EMPTY_FORM = { name: "", order_date: "", item: "", quantity: 1, notes: "" };

// ---------------------------------------------------------------------------
// פלייבוקס — ריכוז בקשות הזמנה מכל הפלוגות (ported from the former
// Delegations.jsx PlayboxTab, unchanged in behavior other than the
// "אוטומטי" badge for orders the stock-gap action generated by itself).
// ---------------------------------------------------------------------------
function PlayboxOrders({ user }) {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  // No pluga here — an order is relevant to everyone, not tagged to a
  // specific pluga (see supabase/migrations/0013_playbox_orders_optional_pluga.sql).
  const [form, setForm] = useState({ ...EMPTY_FORM, order_date: toDateStr(new Date()) });
  const [saving, setSaving] = useState(false);
  // Non-null while the edit dialog is open — the order being edited; saving
  // it resets approved back to false (feature request: "גם אחרי עדכון
  // הזמנה יש לאשר אותה מחדש").
  const [editingOrder, setEditingOrder] = useState(null);
  // Order awaiting a destination-warehouse choice before it's actually
  // marked "התקבל" — see handleChooseDestination / the dialog at the bottom
  // of this component's render.
  const [receivingOrder, setReceivingOrder] = useState(null);
  const [approving, setApproving] = useState(null);

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
        order_date: form.order_date,
        name: form.name.trim() || null,
        item: form.item.trim(),
        quantity: Number(form.quantity) || 1,
        notes: form.notes.trim() || null,
        status: "ממתין",
        auto_generated: false,
      });
      setForm({ ...EMPTY_FORM, order_date: form.order_date });
      await load();
      toast({ title: "ההזמנה נוספה", duration: 2000 });
    } catch (err) {
      toast({ title: "שגיאה בהוספת ההזמנה", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (order) => {
    setEditingOrder({
      id: order.id,
      name: order.name || "",
      order_date: order.order_date,
      item: order.item,
      quantity: order.quantity,
      notes: order.notes || "",
    });
  };

  // Saving an edit always clears approval (approved: false /
  // approved_by_name/approved_by_id/approved_at: null) — per the feature
  // request, any change to the order needs a fresh approval, since whatever
  // was approved before might not match the new content anymore.
  const handleSaveEdit = async () => {
    if (!editingOrder || !editingOrder.item.trim()) return;
    setSaving(true);
    try {
      await base44.entities.PlayboxOrder.update(editingOrder.id, {
        name: editingOrder.name.trim() || null,
        order_date: editingOrder.order_date,
        item: editingOrder.item.trim(),
        quantity: Number(editingOrder.quantity) || 1,
        notes: editingOrder.notes.trim() || null,
        approved: false,
        approved_by_name: null,
        approved_by_id: null,
        approved_at: null,
      });
      setEditingOrder(null);
      await load();
      toast({ title: "ההזמנה עודכנה", description: "יש לאשר אותה מחדש", duration: 2500 });
    } catch (err) {
      toast({ title: "שגיאה בעדכון ההזמנה", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Any playbox_orders holder can approve (or un-approve) ANY order, not
  // just their own — feature request: "כל מי שיש לו הרשאות לפלייבוקס יכול
  // לאשר כל הזמנה".
  const handleToggleApprove = async (order) => {
    setApproving(order.id);
    try {
      if (order.approved) {
        await base44.entities.PlayboxOrder.update(order.id, {
          approved: false, approved_by_name: null, approved_by_id: null, approved_at: null,
        });
      } else {
        await base44.entities.PlayboxOrder.update(order.id, {
          approved: true,
          approved_by_name: user?.full_name || user?.email || null,
          approved_by_id: user?.id || null,
          approved_at: new Date().toISOString(),
        });
      }
      await load();
    } catch (err) {
      toast({ title: "שגיאה באישור ההזמנה", description: err.message, variant: "destructive" });
    } finally {
      setApproving(null);
    }
  };

  // Every path into "התקבל" (the dedicated button, or picking it in the
  // status dropdown) opens the destination-warehouse dialog instead of
  // applying immediately — receiving isn't complete until we know which
  // physical warehouse the goods went into (see handleConfirmReceive).
  // Any other status change applies right away.
  const handleStatus = async (order, status) => {
    if (status === "התקבל" && order.status !== "התקבל") {
      setReceivingOrder(order);
      return;
    }
    try {
      await base44.entities.PlayboxOrder.update(order.id, { status });
      await load();
    } catch (err) {
      toast({ title: "שגיאה בעדכון הסטטוס", description: err.message, variant: "destructive" });
    }
  };

  // Marking an order "התקבל" is a separate, explicit step from "הוזמן" (see
  // supabase/migrations/0009_playbox_orders_received_status.sql) — placing
  // the order and it actually showing up are two different events. Once a
  // destination warehouse is chosen (see the dialog below), receiving an
  // order credits that physical warehouse's warehouse_items quantity (see
  // supabase/migrations/0010_playbox_orders_destination_warehouse.sql), so
  // the goods actually show up in "משיכות ציוד" — creating that warehouse
  // item if it doesn't exist there yet. (This used to also credit a
  // matching pluga-level playbox_items row's "יש כרגע" — dropped along with
  // the rest of that per-pluga stock tracking; see the comment on Playbox()
  // above.)
  const handleConfirmReceive = async (warehouse) => {
    const order = receivingOrder;
    if (!order) return;
    setReceivingOrder(null);
    try {
      await base44.entities.PlayboxOrder.update(order.id, { status: "התקבל", destination_warehouse: warehouse });

      const warehouseMatches = await base44.entities.WarehouseItem.filter({ warehouse, name: order.item });
      if (warehouseMatches.length > 0) {
        const wi = warehouseMatches[0];
        await base44.entities.WarehouseItem.update(wi.id, { quantity: Number(wi.quantity) + Number(order.quantity) });
      } else {
        await base44.entities.WarehouseItem.create({ warehouse, name: order.item, quantity: Number(order.quantity), returnable: false });
      }

      await load();
      toast({ title: "ההזמנה סומנה כהתקבלה", description: `"${order.item}" נוסף ל${warehouse}`, duration: 3000 });
    } catch (err) {
      toast({ title: "שגיאה בסימון כהתקבל", description: err.message, variant: "destructive" });
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

  const handleCopyOrder = (order) => {
    navigator.clipboard?.writeText(formatOneOrderAsText(order));
    toast({ title: "ההזמנה הועתקה", duration: 1500 });
  };

  // Only "ממתין" — these are the ones nobody has actually placed on
  // Playbox's site yet, which is the whole reason to relay the list; an
  // already-"הוזמן" order doesn't need re-sharing.
  const pendingOrders = orders.filter((o) => o.status === "ממתין");

  const handleCopyAllPending = () => {
    if (pendingOrders.length === 0) {
      toast({ title: "אין הזמנות ממתינות להעתקה", duration: 2000 });
      return;
    }
    navigator.clipboard?.writeText(formatOrdersAsText(pendingOrders));
    toast({ title: "הטקסט הועתק", duration: 1500 });
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="border rounded-lg p-3 bg-white space-y-2">
        <p className="text-sm font-medium">הוספת בקשת הזמנה</p>
        <Input placeholder="שם ההזמנה (אופציונלי)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-9 text-sm" />
        <Input type="date" value={form.order_date} onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))} className="h-9 text-sm" />
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

      <Button
        size="sm"
        variant="outline"
        onClick={handleCopyAllPending}
        className="w-full gap-1.5"
        disabled={pendingOrders.length === 0}
      >
        <Copy className="w-3.5 h-3.5" />
        העתק הזמנות ממתינות כטקסט{pendingOrders.length > 0 ? ` (${pendingOrders.length})` : ""}
      </Button>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : orders.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">אין בקשות הזמנה עדיין</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="border rounded-lg p-3 bg-white flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* No current path in the app sets pluga on an order
                      anymore (see supabase/migrations/0013_playbox_orders_optional_pluga.sql
                      and the removal of the old pluga-level "מלאי ומעקב
                      חוסרים" tab) — this only guards against a pluga left
                      over on older data. */}
                  {o.pluga && (
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", PLUGA_COLORS[o.pluga]?.light)}>{o.pluga}</span>
                  )}
                  {o.name && <span className="text-sm font-semibold">{o.name} ·</span>}
                  <span className="text-sm font-medium">{o.item} × {o.quantity}</span>
                  {o.auto_generated && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      אוטומטי
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1",
                      o.approved ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    )}
                    title={o.approved && o.approved_by_name ? `אושר ע"י ${o.approved_by_name}` : undefined}
                  >
                    {o.approved ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                    {o.approved ? "מאושר" : "לא מאושר"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {o.order_date}{o.notes ? ` · ${o.notes}` : ""}
                  {o.status === "התקבל" && o.destination_warehouse && ` · התקבל ל${o.destination_warehouse}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleApprove(o)}
                  disabled={approving === o.id}
                  className={cn("h-8 gap-1 text-xs", o.approved ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50" : "")}
                >
                  {approving === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : o.approved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                  {o.approved ? "בטל אישור" : "אשר"}
                </Button>
                {o.status === "הוזמן" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReceivingOrder(o)}
                    className="h-8 gap-1 text-xs border-green-300 text-green-700 hover:bg-green-50"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    התקבל
                  </Button>
                )}
                <Select value={o.status} onValueChange={(v) => handleStatus(o, v)}>
                  <SelectTrigger className={cn("h-8 text-xs w-24 border-0", STATUS_BADGE_STYLE[o.status])}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(STATUS_LABELS).map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(o)} title="ערוך הזמנה">
                  <Pencil className="w-3.5 h-3.5 text-slate-500" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleCopyOrder(o)} title="העתק הזמנה">
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(o)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editingOrder} onOpenChange={(o) => !o && setEditingOrder(null)}>
        <DialogContent className="sm:max-w-[420px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת הזמנה</DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <div className="space-y-3">
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                שמירת שינויים תבטל אישור קודם — ההזמנה תצטרך אישור מחדש.
              </p>
              <div className="space-y-1.5">
                <Label>שם ההזמנה (אופציונלי)</Label>
                <Input value={editingOrder.name} onChange={(e) => setEditingOrder((o) => ({ ...o, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>תאריך</Label>
                <Input type="date" value={editingOrder.order_date} onChange={(e) => setEditingOrder((o) => ({ ...o, order_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>פריט</Label>
                <Input value={editingOrder.item} onChange={(e) => setEditingOrder((o) => ({ ...o, item: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>כמות</Label>
                <Input type="number" min="1" value={editingOrder.quantity} onChange={(e) => setEditingOrder((o) => ({ ...o, quantity: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>הערות</Label>
                <Input value={editingOrder.notes} onChange={(e) => setEditingOrder((o) => ({ ...o, notes: e.target.value }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrder(null)} disabled={saving}>ביטול</Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editingOrder?.item?.trim()}>
              {saving ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receivingOrder} onOpenChange={(o) => !o && setReceivingOrder(null)}>
        <DialogContent className="sm:max-w-[380px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>לאן ההזמנה הולכת?</DialogTitle>
          </DialogHeader>
          {receivingOrder && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                "{receivingOrder.item}" × {receivingOrder.quantity}{receivingOrder.pluga ? ` (${receivingOrder.pluga})` : ""} — לאיזה מחסן זה מגיע?
              </p>
              <div className="space-y-2">
                {WAREHOUSES.map((w) => (
                  <button
                    key={w}
                    onClick={() => handleConfirmReceive(w)}
                    className="w-full flex items-center gap-2 border rounded-lg p-3 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    <Warehouse className="w-4 h-4 text-slate-500 shrink-0" />
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
