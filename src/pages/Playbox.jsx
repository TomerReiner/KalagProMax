import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Loader2, Truck, Plus, Trash2, Sparkles, PackageCheck, Warehouse, Copy, Pencil,
  CheckCircle2, Circle, FileSpreadsheet, X,
} from "lucide-react";
import { WAREHOUSES, toDateStr } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { hasPermission, effectivePermissions } from "@/lib/permissions";
import { usePreviewRole } from "@/lib/previewRoleContext";
import {
  PLAYBOX_STATUSES, orderItems, formatOrderAsText, formatOrdersAsText, exportOrderToExcel,
} from "@/lib/playbox";

// "פלייבוקס" — an order is one playbox_orders row with a name, a date and a
// list of items ({ name, quantity, note }, see src/lib/playbox.js and
// supabase/migrations/0019_playbox_multi_item_orders_and_permission_guards.sql).
//
// Who can do what (feature request):
//  - EVERY signed-in user can open this page, create an order and edit it
//    (add/change/remove items) while it's still "ממתין".
//  - Only an approver — admin, סגל, or a holder of the playbox_orders
//    permission (see effectivePermissions in src/lib/permissions.js) — can
//    approve an order, change its status, or mark it received.
//  - Any edit clears the approval, so an approver has to re-approve the
//    changed order. The same rules are enforced in the database by the
//    playbox_orders_guard trigger (migration 0019), not only here.
//
// Status flow: ממתין → הוזמן (needs approval first) → התקבל, or בוטל.
// "התקבל" asks which physical warehouse the goods went into and credits
// every item into that warehouse's warehouse_items (creating missing ones),
// so it shows up in "משיכות ציוד".
const STATUS_BADGE_STYLE = {
  "ממתין": "bg-slate-100 text-slate-600",
  "הוזמן": "bg-blue-100 text-blue-700",
  "התקבל": "bg-green-100 text-green-700",
  "בוטל": "bg-red-100 text-red-600",
};

const EMPTY_ITEM = { name: "", quantity: 1, note: "" };

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

  const effectiveRole = previewRole || user.role;
  const canApprove = hasPermission(effectivePermissions(myPermissions, effectiveRole), "playbox_orders");

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-center gap-2">
        <Truck className="w-5 h-5 text-slate-500" />
        <h1 className="text-xl font-bold">פלייבוקס</h1>
      </div>
      <p className="text-xs text-center text-muted-foreground">
        {canApprove
          ? "את/ה מאשר/ת הזמנות — כל הזמנה חדשה או שעודכנה ממתינה לאישורך"
          : "אפשר ליצור ולערוך הזמנות. כל שינוי עובר לאישור מנהל או אחראי פלייבוקס"}
      </p>
      <PlayboxOrders user={user} canApprove={canApprove} />
    </div>
  );
}

function PlayboxOrders({ user, canApprove }) {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("active");
  // null = closed; { id?, wasApproved?, name, order_date, notes, items } = open
  const [editingOrder, setEditingOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState(null);
  const [busyId, setBusyId] = useState(null);
  // Deep links: ?order=<id> scrolls to and briefly highlights that order
  // (switching to the archive tab if that's where it lives), ?new=1 opens
  // the "הזמנה חדשה" dialog.
  const [searchParams, setSearchParams] = useSearchParams();
  const [highlightId, setHighlightId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await base44.entities.PlayboxOrder.list("-order_date", 300);
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

  useEffect(() => {
    const orderId = searchParams.get("order");
    const wantsNew = searchParams.get("new") === "1";
    if (!orderId && !wantsNew) return;
    if (wantsNew) {
      setEditingOrder({ name: "", order_date: toDateStr(new Date()), notes: "", items: [{ ...EMPTY_ITEM }] });
    } else {
      if (loading) return;
      const target = orders.find((o) => o.id === orderId);
      if (target) {
        setView(target.status === "התקבל" || target.status === "בוטל" ? "archive" : "active");
        setHighlightId(orderId);
        setTimeout(() => document.getElementById(`order-${orderId}`)?.scrollIntoView({ block: "center" }), 150);
        setTimeout(() => setHighlightId(null), 2600);
      }
    }
    const next = new URLSearchParams(searchParams);
    next.delete("order");
    next.delete("new");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, orders, loading]);

  const openCreate = () => {
    setEditingOrder({ name: "", order_date: toDateStr(new Date()), notes: "", items: [{ ...EMPTY_ITEM }] });
  };

  const openEdit = (order) => {
    setEditingOrder({
      id: order.id,
      wasApproved: !!order.approved,
      name: order.name || "",
      order_date: order.order_date || toDateStr(new Date()),
      notes: order.notes || "",
      items: orderItems(order).map((i) => ({ name: i.name || "", quantity: i.quantity ?? 1, note: i.note || "" })),
    });
  };

  const handleSave = async () => {
    const o = editingOrder;
    const items = o.items
      .filter((i) => i.name.trim())
      .map((i) => ({ name: i.name.trim(), quantity: Number(i.quantity) || 1, note: i.note.trim() || null }));
    if (!o.name.trim() || items.length === 0) return;
    setSaving(true);
    const payload = {
      name: o.name.trim(),
      order_date: o.order_date,
      notes: o.notes.trim() || null,
      items,
    };
    try {
      if (o.id) {
        // Any edit clears approval (the DB trigger does this too; doing it
        // here as well keeps test mode, which has no trigger, identical).
        await base44.entities.PlayboxOrder.update(o.id, {
          ...payload,
          approved: false, approved_by_name: null, approved_by_id: null, approved_at: null,
        });
        toast({
          title: "ההזמנה עודכנה",
          description: o.wasApproved ? "האישור הקודם בוטל — ההזמנה ממתינה לאישור מחדש" : "ממתינה לאישור",
          duration: 3000,
        });
      } else {
        await base44.entities.PlayboxOrder.create({ ...payload, status: "ממתין", auto_generated: false, approved: false });
        toast({ title: "ההזמנה נוצרה", description: "ממתינה לאישור", duration: 2500 });
      }
      setEditingOrder(null);
      await load();
    } catch (err) {
      toast({ title: "שגיאה בשמירת ההזמנה", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleApprove = async (order) => {
    setBusyId(order.id);
    try {
      await base44.entities.PlayboxOrder.update(order.id, order.approved
        ? { approved: false, approved_by_name: null, approved_by_id: null, approved_at: null }
        : {
            approved: true,
            approved_by_name: user?.full_name || user?.email || null,
            approved_by_id: user?.id || null,
            approved_at: new Date().toISOString(),
          });
      await load();
    } catch (err) {
      toast({ title: "שגיאה באישור ההזמנה", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleStatus = async (order, status) => {
    if (status === order.status) return;
    if (status === "התקבל") {
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

  const handleConfirmReceive = async (warehouse) => {
    const order = receivingOrder;
    if (!order) return;
    setReceivingOrder(null);
    try {
      await base44.entities.PlayboxOrder.update(order.id, { status: "התקבל", destination_warehouse: warehouse });
      for (const item of orderItems(order)) {
        const matches = await base44.entities.WarehouseItem.filter({ warehouse, name: item.name });
        if (matches.length > 0) {
          const wi = matches[0];
          await base44.entities.WarehouseItem.update(wi.id, { quantity: Number(wi.quantity) + Number(item.quantity) });
        } else {
          await base44.entities.WarehouseItem.create({ warehouse, name: item.name, quantity: Number(item.quantity), returnable: false });
        }
      }
      await load();
      toast({ title: "ההזמנה סומנה כהתקבלה", description: `${orderItems(order).length} פריטים נוספו ל${warehouse}`, duration: 3000 });
    } catch (err) {
      toast({ title: "שגיאה בסימון כהתקבל", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (order) => {
    if (!window.confirm(`למחוק את ההזמנה "${order.name || ""}"?`)) return;
    try {
      await base44.entities.PlayboxOrder.delete(order.id);
      await load();
    } catch (err) {
      toast({ title: "שגיאה במחיקה", description: err.message, variant: "destructive" });
    }
  };

  const handleCopyOrder = (order) => {
    navigator.clipboard?.writeText(formatOrderAsText(order));
    toast({ title: "ההזמנה הועתקה", duration: 1500 });
  };

  const pendingOrders = orders.filter((o) => o.status === "ממתין");
  const handleCopyAllPending = () => {
    navigator.clipboard?.writeText(formatOrdersAsText(pendingOrders));
    toast({ title: "הטקסט הועתק", duration: 1500 });
  };

  const isArchived = (o) => o.status === "התקבל" || o.status === "בוטל";
  const visible = orders.filter((o) => (view === "archive" ? isArchived(o) : !isArchived(o)));
  const awaitingApproval = orders.filter((o) => !isArchived(o) && !o.approved).length;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button onClick={openCreate} className="gap-1.5 flex-1">
          <Plus className="w-4 h-4" />
          הזמנה חדשה
        </Button>
        <Button variant="outline" onClick={handleCopyAllPending} className="gap-1.5" disabled={pendingOrders.length === 0}>
          <Copy className="w-4 h-4" />
          העתק ממתינות{pendingOrders.length > 0 ? ` (${pendingOrders.length})` : ""}
        </Button>
      </div>

      <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
        {[["active", `פעילות${awaitingApproval > 0 ? ` · ${awaitingApproval} ממתינות לאישור` : ""}`], ["archive", "ארכיון"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={cn(
              "flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              view === key ? "bg-white text-slate-900 shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : visible.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">
          {view === "archive" ? "אין הזמנות בארכיון" : "אין הזמנות פעילות — לחצו \"הזמנה חדשה\""}
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              highlighted={highlightId === o.id}
              canApprove={canApprove}
              canDelete={canApprove || (o.created_by_id && o.created_by_id === user?.id)}
              busy={busyId === o.id}
              onEdit={() => openEdit(o)}
              onApprove={() => handleToggleApprove(o)}
              onStatus={(s) => handleStatus(o, s)}
              onCopy={() => handleCopyOrder(o)}
              onExport={() => exportOrderToExcel(o)}
              onDelete={() => handleDelete(o)}
            />
          ))}
        </div>
      )}

      <OrderDialog
        order={editingOrder}
        setOrder={setEditingOrder}
        saving={saving}
        onSave={handleSave}
        onClose={() => setEditingOrder(null)}
      />

      <Dialog open={!!receivingOrder} onOpenChange={(open) => { if (!open) setReceivingOrder(null); }}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>לאן ההזמנה הולכת?</DialogTitle>
          </DialogHeader>
          {receivingOrder && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                "{receivingOrder.name}" — {orderItems(receivingOrder).length} פריטים. לאיזה מחסן זה מגיע? כל הפריטים יתווספו למלאי של המחסן שנבחר.
              </p>
              <div className="grid gap-2">
                {WAREHOUSES.map((w) => (
                  <Button key={w} variant="outline" className="justify-start gap-2" onClick={() => handleConfirmReceive(w)}>
                    <Warehouse className="w-4 h-4" />
                    {w}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReceivingOrder(null)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderCard({ order: o, highlighted, canApprove, canDelete, busy, onEdit, onApprove, onStatus, onCopy, onExport, onDelete }) {
  const items = orderItems(o);
  const editable = o.status === "ממתין";
  return (
    <div
      id={`order-${o.id}`}
      className={cn(
        "border-2 rounded-xl bg-white overflow-hidden transition-shadow",
        o.approved ? "border-emerald-200" : "border-border",
        highlighted && "ring-4 ring-amber-300"
      )}
    >
      <div className="p-3 flex items-start justify-between gap-2 flex-wrap border-b bg-slate-50/60">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold">{o.name || "הזמנה ללא שם"}</span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_BADGE_STYLE[o.status])}>{o.status}</span>
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1",
                o.approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              )}
            >
              {o.approved ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
              {o.approved ? `אושר${o.approved_by_name ? ` ע"י ${o.approved_by_name}` : ""}` : "ממתין לאישור"}
            </span>
            {o.auto_generated && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-violet-100 text-violet-700 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                אוטומטי
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {o.order_date} · {items.length} פריטים
            {o.status === "התקבל" && o.destination_warehouse && ` · התקבל ל${o.destination_warehouse}`}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {editable && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit} title="ערוך הזמנה">
              <Pencil className="w-4 h-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onCopy} title="העתק כטקסט">
            <Copy className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-700" onClick={onExport} title="ייצוא לאקסל">
            <FileSpreadsheet className="w-4 h-4" />
          </Button>
          {canDelete && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onDelete} title="מחק הזמנה">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground border-b">
            <th className="text-right font-medium px-3 py-1.5">פריט</th>
            <th className="text-right font-medium px-3 py-1.5 w-20">כמות</th>
            <th className="text-right font-medium px-3 py-1.5">מידה/הערה</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i, idx) => (
            <tr key={idx} className="border-b last:border-b-0">
              <td className="px-3 py-1.5 font-medium">{i.name}</td>
              <td className="px-3 py-1.5">{i.quantity}</td>
              <td className="px-3 py-1.5 text-muted-foreground">{i.note || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {o.notes && <p className="text-xs text-muted-foreground px-3 py-2 border-t">הערות: {o.notes}</p>}

      {canApprove && (o.status === "ממתין" || o.status === "הוזמן") && (
        <div className="flex items-center gap-2 flex-wrap p-3 border-t bg-slate-50/60">
          <Button
            size="sm"
            variant="outline"
            onClick={onApprove}
            disabled={busy}
            className={cn("h-8 gap-1 text-xs", o.approved ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50" : "border-amber-300")}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : o.approved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
            {o.approved ? "בטל אישור" : "אשר הזמנה"}
          </Button>
          {o.status === "הוזמן" && (
            <Button size="sm" onClick={() => onStatus("התקבל")} className="h-8 gap-1 text-xs bg-green-600 hover:bg-green-700">
              <PackageCheck className="w-3.5 h-3.5" />
              התקבל
            </Button>
          )}
          <Select value={o.status} onValueChange={onStatus}>
            <SelectTrigger className="h-8 w-28 text-xs mr-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLAYBOX_STATUSES.map((s) => (
                // Ordering/receiving an order that was never approved is
                // exactly what the approval step exists to prevent.
                <SelectItem key={s} value={s} disabled={!o.approved && (s === "הוזמן" || s === "התקבל")}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function OrderDialog({ order, setOrder, saving, onSave, onClose }) {
  if (!order) return null;
  const setField = (field, value) => setOrder((o) => ({ ...o, [field]: value }));
  const setItem = (idx, field, value) =>
    setOrder((o) => ({ ...o, items: o.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)) }));
  const addItem = () => setOrder((o) => ({ ...o, items: [...o.items, { ...EMPTY_ITEM }] }));
  const removeItem = (idx) => setOrder((o) => ({ ...o, items: o.items.filter((_, i) => i !== idx) }));
  const hasItem = order.items.some((i) => i.name.trim());

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{order.id ? "עריכת הזמנה" : "הזמנה חדשה"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {order.id && order.wasApproved && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              ההזמנה כבר אושרה — שמירת שינויים תבטל את האישור והיא תחזור לאישור מחדש.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-3">
            <div className="space-y-1.5">
              <Label>שם ההזמנה *</Label>
              <Input value={order.name} onChange={(e) => setField("name", e.target.value)} placeholder="לדוגמה: הזמנה שבועית" />
            </div>
            <div className="space-y-1.5">
              <Label>תאריך</Label>
              <Input type="date" value={order.order_date} onChange={(e) => setField("order_date", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>פריטים *</Label>
            <div className="grid grid-cols-[1fr_64px_1fr_32px] gap-2 text-xs text-muted-foreground px-0.5">
              <span>שם פריט</span>
              <span>כמות</span>
              <span>מידה/הערה</span>
              <span />
            </div>
            {order.items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_64px_1fr_32px] gap-2 items-center">
                <Input value={it.name} onChange={(e) => setItem(idx, "name", e.target.value)} placeholder="שם הפריט" className="h-9" />
                <Input type="number" min="0" step="any" value={it.quantity} onChange={(e) => setItem(idx, "quantity", e.target.value)} className="h-9 px-2" />
                <Input value={it.note} onChange={(e) => setItem(idx, "note", e.target.value)} placeholder="יחידות / מטר..." className="h-9" />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => removeItem(idx)}
                  disabled={order.items.length === 1}
                  title="הסר פריט"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5 w-full border-dashed">
              <Plus className="w-3.5 h-3.5" />
              הוסף פריט
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>הערות להזמנה (אופציונלי)</Label>
            <Textarea value={order.notes} onChange={(e) => setField("notes", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>ביטול</Button>
          <Button onClick={onSave} disabled={saving || !order.name.trim() || !hasItem}>
            {saving ? "שומר..." : order.id ? "שמור ושלח לאישור" : "צור הזמנה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
