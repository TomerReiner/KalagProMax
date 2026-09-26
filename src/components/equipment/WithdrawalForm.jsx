import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLUGOT, PLUGA_COLORS, toDateStr } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { Loader2, Copy } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function WithdrawalForm({ open, onClose, warehouse, items, userPluga, onDone }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState({});
  const [pluga, setPluga] = useState(userPluga || "");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Items that would drop below their target_quantity (see
  // supabase/migrations/0012_warehouse_item_target_quantity.sql) if this
  // withdrawal goes through — non-null while showing the confirm step below.
  const [shortages, setShortages] = useState(null);
  const [includeAutoOrder, setIncludeAutoOrder] = useState(true);
  // Text of the Playbox completion order(s) actually created, once the
  // withdrawal itself has already been submitted successfully — shown as a
  // final "copy it" step instead of closing right away.
  const [shareText, setShareText] = useState(null);

  useEffect(() => {
    if (open) {
      setSelected({});
      setPluga(userPluga || "");
      setExpectedReturnDate("");
      setNotes("");
      setError("");
      setShortages(null);
      setIncludeAutoOrder(true);
      setShareText(null);
    }
  }, [open, userPluga]);

  const toggleItem = (id) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  };

  const setQty = (id, qty) => {
    setSelected((prev) => ({ ...prev, [id]: Math.max(1, qty) }));
  };

  const selectedItems = Object.entries(selected).map(([id, qty]) => {
    const item = items.find((i) => i.id === id);
    return { id, name: item?.name, quantity: qty, returnable: item?.returnable };
  });

  // Items with no target_quantity configured have it default to 0 (see the
  // migration above), so they can never look "short" here — this only fires
  // for items someone with the playbox_orders/equipment_manager permission
  // actually set a target for.
  const computeShortages = () =>
    selectedItems
      .map((si) => {
        const item = items.find((i) => i.id === si.id);
        const target = Number(item?.target_quantity) || 0;
        if (!item || target <= 0) return null;
        const remaining = Number(item.quantity) - Number(si.quantity);
        if (remaining >= target) return null;
        return { name: item.name, remaining, target, shortfall: target - remaining };
      })
      .filter(Boolean);

  // Creates a playbox_orders row (auto_generated: true) per shortage that
  // doesn't already have one pending, attributed to the withdrawing pluga —
  // playbox_orders always needs one (see 0001_init.sql), and this is a
  // shared warehouse shortage rather than any one pluga's own supply, so the
  // pluga making the withdrawal that surfaced it is the most reasonable
  // owner. Dedup is by item name alone (not pluga+item, unlike the
  // pluga-level gap orders in Playbox.jsx) since the physical stock being
  // replenished is shared — an auto order already pending for this item from
  // ANY pluga covers the same shortage. Returns the text of what was
  // actually created, or null if everything was already covered by an
  // existing pending/ordered auto order.
  const createAutoOrders = async (shortageList, forPluga) => {
    try {
      const existingOrders = await base44.entities.PlayboxOrder.list("-order_date", 500);
      const hasPendingAuto = (name) =>
        existingOrders.some(
          (o) => o.item === name && o.auto_generated && (o.status === "ממתין" || o.status === "הוזמן")
        );
      const today = toDateStr(new Date());
      const created = [];
      for (const s of shortageList) {
        if (hasPendingAuto(s.name)) continue;
        await base44.entities.PlayboxOrder.create({
          pluga: forPluga,
          order_date: today,
          item: s.name,
          quantity: s.shortfall,
          notes: "נוצר אוטומטית ממשיכת ציוד",
          status: "ממתין",
          auto_generated: true,
        });
        created.push(s);
      }
      if (created.length === 0) return null;
      const lines = created.map((s) => `• ${s.name} × ${s.shortfall}`);
      return `בקשת השלמת מלאי לפלייבוקס (${forPluga}):\n${lines.join("\n")}`;
    } catch (err) {
      toast({ title: "שגיאה ביצירת הזמנת השלמה", description: err.message, variant: "destructive" });
      return null;
    }
  };

  const doSubmit = async (shortageList) => {
    setSaving(true);
    setError("");
    try {
      const createdText = shortageList.length > 0 ? await createAutoOrders(shortageList, pluga) : null;
      await base44.functions.invoke("processWithdrawal", {
        warehouse,
        items: selectedItems.map((i) => ({ name: i.name, quantity: i.quantity, returnable: i.returnable })),
        pluga,
        expected_return_date: expectedReturnDate || undefined,
        notes: notes || undefined,
      });
      toast({
        title: "הבקשה נשלחה בהצלחה",
        description: "הבקשה ממתינה לאישור מנהל/אחראי משיכות",
        duration: 4000,
      });
      onDone();
      if (createdText) {
        setShortages(null);
        setShareText(createdText);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "שגיאה בשליחת הבקשה");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitClick = () => {
    if (selectedItems.length === 0) {
      setError("בחר לפחות פריט אחד");
      return;
    }
    if (!pluga) {
      setError("בחר פלוגה");
      return;
    }
    setError("");
    const detected = computeShortages();
    if (detected.length > 0) {
      setShortages(detected);
      return;
    }
    doSubmit([]);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto" dir="rtl">
        {shareText ? (
          <>
            <DialogHeader>
              <DialogTitle>בקשת השלמה לפלייבוקס נוצרה</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                הבקשה למשיכת הציוד נשלחה. נוצרה גם בקשת הזמנה להשלמת המלאי — אפשר להעתיק אותה ולשלוח למי שאחראי להזמין בפועל:
              </p>
              <pre className="text-sm whitespace-pre-wrap bg-slate-50 border border-border rounded-lg p-3 font-sans">
                {shareText}
              </pre>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(shareText);
                  toast({ title: "הטקסט הועתק", duration: 1500 });
                }}
                className="w-full gap-1.5"
              >
                <Copy className="w-4 h-4" />
                העתק
              </Button>
            </div>
            <DialogFooter>
              <Button variant="ghost" className="w-full" onClick={onClose}>
                סגור
              </Button>
            </DialogFooter>
          </>
        ) : shortages ? (
          <>
            <DialogHeader>
              <DialogTitle>הכמות תרד מתחת ליעד</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                לאחר המשיכה, הפריטים הבאים יהיו מתחת לכמות היעד שהוגדרה להם:
              </p>
              <div className="space-y-2">
                {shortages.map((s) => (
                  <div key={s.name} className="flex items-center justify-between gap-2 text-sm border border-border rounded-lg p-2.5 bg-white flex-wrap">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      יישאר {s.remaining} · יעד {s.target} · חסר {s.shortfall}
                    </span>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeAutoOrder}
                  onChange={(e) => setIncludeAutoOrder(e.target.checked)}
                  className="w-4 h-4"
                />
                ליצור אוטומטית בקשת הזמנה מהפלייבוקס להשלמת הכמות
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShortages(null)} disabled={saving}>
                חזרה
              </Button>
              <Button onClick={() => doSubmit(includeAutoOrder ? shortages : [])} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    שולח...
                  </>
                ) : (
                  "המשך ושלח בקשה"
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>משיכת ציוד - {warehouse}</DialogTitle>
            </DialogHeader>
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
            )}
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">פריטים זמינים</Label>
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">אין פריטים במחסן זה</p>
                  ) : (
                    items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg border bg-white">
                        <input
                          type="checkbox"
                          checked={!!selected[item.id]}
                          onChange={() => toggleItem(item.id)}
                          className="w-4 h-4"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            זמין: {item.quantity}
                            {item.returnable ? " · להחזרה" : ""}
                          </p>
                        </div>
                        {selected[item.id] && (
                          <Input
                            type="number"
                            min="1"
                            max={item.quantity}
                            value={selected[item.id]}
                            onChange={(e) => setQty(item.id, Number(e.target.value))}
                            className="w-20 h-8"
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>פלוגה *</Label>
                {userPluga ? (
                  <Input value={userPluga} readOnly className="bg-muted" />
                ) : (
                  <Select value={pluga} onValueChange={setPluga}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר פלוגה" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLUGOT.map((p) => (
                        <SelectItem key={p} value={p}>
                          <span className="flex items-center gap-2">
                            <span className={cn("w-3 h-3 rounded-full", PLUGA_COLORS[p]?.dot)} />
                            {p}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>תאריך החזרה צפוי (אופציונלי)</Label>
                <Input
                  type="date"
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>הערות (אופציונלי)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={saving}>
                ביטול
              </Button>
              <Button onClick={handleSubmitClick} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    שולח...
                  </>
                ) : (
                  "שלח בקשה"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
