import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLUGOT, PLUGA_COLORS, WAREHOUSES, FREE_TEXT_WAREHOUSES } from "@/lib/constants";
import { createShortageOrder } from "@/lib/playbox";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { Loader2, Copy, Search, X, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// `allItems` is every item from every warehouse (Equipment.jsx's own
// unfiltered list) so this dialog's own search box (feature request: "במשיכת
// ציוד, בוא נעשה שאפשר לעשות חיפוש על כל המוצרים מכל המחסנים") can search
// across all of them — a cross-warehouse search was added to Equipment.jsx's
// own item list earlier, but the actual "משיכת ציוד" dialog (this file,
// where a withdrawal is actually created) never got one, which was the real
// ask. `defaultWarehouse` is just where the list starts (whatever tab was
// active on the Equipment page); see requestWarehouse below for how it can
// change once you actually pick an item.
export default function WithdrawalForm({ open, onClose, allItems, defaultWarehouse, userPluga, onDone }) {
  const { toast } = useToast();
  // A single withdrawal request still only pulls from one warehouse — the
  // approval step (api/approve-withdrawal.js) looks up stock for the whole
  // request by one `warehouse` value — so this tracks which warehouse the
  // CURRENT selection is pinned to. It starts at defaultWarehouse and can
  // switch once you pick an item from a different warehouse while searching;
  // see toggleItem below.
  const [requestWarehouse, setRequestWarehouse] = useState(defaultWarehouse);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState({});
  // Free-text items — only for FREE_TEXT_WAREHOUSES (מחסן קרביץ / מחסן
  // קליר), whose contents change too fast to keep a full inventory list.
  // [{ name, quantity, returnable }]; sent with `custom: true` so
  // api/approve-withdrawal.js skips the stock check/deduction for them.
  const [customItems, setCustomItems] = useState([]);
  const [customDraft, setCustomDraft] = useState({ name: "", quantity: 1, returnable: false });
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
      setRequestWarehouse(defaultWarehouse);
      setSearch("");
      setSelected({});
      setCustomItems([]);
      setCustomDraft({ name: "", quantity: 1, returnable: false });
      setPluga(userPluga || "");
      setExpectedReturnDate("");
      setNotes("");
      setError("");
      setShortages(null);
      setIncludeAutoOrder(true);
      setShareText(null);
    }
  }, [open, defaultWarehouse, userPluga]);

  const normalizedSearch = search.trim().toLowerCase();
  const isSearching = normalizedSearch.length > 0;
  // While searching, list matches from every list-based warehouse at once
  // (with a warehouse badge per row below). Otherwise, only the warehouse
  // this request is currently pinned to. FREE_TEXT_WAREHOUSES never show a
  // list here — they're "open" warehouses, withdrawn from by typing items.
  const items = isSearching
    ? allItems.filter((i) => !FREE_TEXT_WAREHOUSES.includes(i.warehouse) && i.name.toLowerCase().includes(normalizedSearch))
    : allItems.filter((i) => i.warehouse === requestWarehouse);

  const toggleItem = (item) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
        return next;
      }
      const selectedWarehouses = new Set(
        Object.keys(prev)
          .map((id) => allItems.find((i) => i.id === id)?.warehouse)
          .filter(Boolean)
      );
      if (selectedWarehouses.size > 0 && !selectedWarehouses.has(item.warehouse)) {
        // Picking an item from a different warehouse than what's already
        // selected starts a fresh selection in THAT warehouse instead of
        // silently mixing stock from two warehouses into one request.
        toast({
          title: "אפשר למשוך מתוך מחסן אחד בבקשה אחת",
          description: `הבחירה הקודמת אופסה — ממשיכים עם "${item.warehouse}"`,
          duration: 3000,
        });
        setRequestWarehouse(item.warehouse);
        setCustomItems([]);
        return { [item.id]: 1 };
      }
      if (selectedWarehouses.size === 0 && item.warehouse !== requestWarehouse) {
        setRequestWarehouse(item.warehouse);
        setCustomItems([]);
      }
      next[item.id] = 1;
      return next;
    });
  };

  const allowsCustom = FREE_TEXT_WAREHOUSES.includes(requestWarehouse);

  const switchWarehouse = (w) => {
    if (w === requestWarehouse) return;
    setRequestWarehouse(w);
    setSelected({});
    setCustomItems([]);
    setSearch("");
  };

  const draftAsItem = () => {
    const name = customDraft.name.trim();
    if (!name) return null;
    return { name, quantity: Math.max(1, Number(customDraft.quantity) || 1), returnable: customDraft.returnable };
  };

  const addCustomItem = () => {
    const item = draftAsItem();
    if (!item) return;
    setError("");
    setCustomItems((prev) => [...prev, item]);
    setCustomDraft({ name: "", quantity: 1, returnable: false });
  };

  const setQty = (id, qty) => {
    setSelected((prev) => ({ ...prev, [id]: Math.max(1, qty) }));
  };

  const selectedItems = Object.entries(selected).map(([id, qty]) => {
    const item = allItems.find((i) => i.id === id);
    return { id, name: item?.name, quantity: qty, returnable: item?.returnable };
  });

  // Items with no target_quantity configured have it default to 0 (see the
  // migration above), so they can never look "short" here — this only fires
  // for items someone with the playbox_orders/equipment_manager permission
  // actually set a target for.
  const computeShortages = () =>
    selectedItems
      .map((si) => {
        const item = allItems.find((i) => i.id === si.id);
        const target = Number(item?.target_quantity) || 0;
        if (!item || target <= 0) return null;
        const remaining = Number(item.quantity) - Number(si.quantity);
        if (remaining >= target) return null;
        return { name: item.name, remaining, target, shortfall: target - remaining };
      })
      .filter(Boolean);

  // Creates a playbox_orders row (auto_generated: true) per shortage that
  // doesn't already have one pending. playbox_orders no longer needs a pluga
  // at all (see supabase/migrations/0013_playbox_orders_optional_pluga.sql)
  // — this is a shared-warehouse shortage, not any one pluga's own supply,
  // so the order itself doesn't name one; forPluga is used only for the
  // "here's what got created" message shown to whoever triggered it, below.
  // Dedup is by item name alone (not pluga+item, unlike the pluga-level gap
  // orders in Playbox.jsx) since the physical stock being replenished is
  // shared — an auto order already pending for this item from ANY pluga
  // covers the same shortage. Returns the text of what was actually
  // created, or null if everything was already covered by an existing
  // pending/ordered auto order.
  const createAutoOrders = async (shortageList, forPluga) => {
    try {
      const created = await createShortageOrder(
        shortageList.map((sh) => ({ name: sh.name, quantity: sh.shortfall })),
        "נוצר אוטומטית ממשיכת ציוד"
      );
      if (!created) return null;
      const lines = created.items.map((i) => `• ${i.name} × ${i.quantity}`);
      return `בקשת השלמת מלאי לפלייבוקס (${forPluga}):\n${lines.join("\n")}`;
    } catch (err) {
      toast({ title: "שגיאה ביצירת הזמנת השלמה", description: err.message, variant: "destructive" });
      return null;
    }
  };

  // A row typed into the free-text fields but never "הוסף"-ed still counts
  // — pressing "שלח בקשה" right after typing shouldn't silently drop it.
  const pendingDraft = allowsCustom ? draftAsItem() : null;
  const submitCustomItems = pendingDraft ? [...customItems, pendingDraft] : customItems;

  const doSubmit = async (shortageList) => {
    setSaving(true);
    setError("");
    try {
      const createdText = shortageList.length > 0 ? await createAutoOrders(shortageList, pluga) : null;
      await base44.functions.invoke("processWithdrawal", {
        warehouse: requestWarehouse,
        items: [
          ...selectedItems.map((i) => ({ name: i.name, quantity: i.quantity, returnable: i.returnable })),
          ...(allowsCustom ? submitCustomItems.map((i) => ({ ...i, custom: true })) : []),
        ],
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
    if (allowsCustom ? submitCustomItems.length === 0 : selectedItems.length === 0) {
      setError(allowsCustom ? "כתוב לפחות פריט אחד" : "בחר לפחות פריט אחד");
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
              <DialogTitle>משיכת ציוד - {requestWarehouse}</DialogTitle>
            </DialogHeader>
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="block">מאיזה מחסן מושכים? *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {WAREHOUSES.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => switchWarehouse(w)}
                      className={cn(
                        "px-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors",
                        requestWarehouse === w
                          ? "bg-slate-900 border-slate-900 text-white"
                          : "bg-white border-border text-slate-600 hover:border-slate-400"
                      )}
                    >
                      {w}
                      <span className={cn("block text-[10px] font-normal", requestWarehouse === w ? "text-slate-300" : "text-muted-foreground")}>
                        {FREE_TEXT_WAREHOUSES.includes(w) ? "כתיבה חופשית" : "מתוך רשימה"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {allowsCustom ? (
                <div className="space-y-2">
                  <Label className="block">פריטים למשיכה</Label>
                  <p className="text-xs text-muted-foreground">
                    {requestWarehouse} הוא מחסן פתוח — כותבים כל פריט שרוצים למשוך, בלי לבחור מרשימה.
                  </p>
                  {customItems.map((ci, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm bg-white border rounded-lg px-2.5 py-1.5">
                      <span className="flex-1 font-medium">{ci.name} ×{ci.quantity}</span>
                      {ci.returnable && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">להחזרה</span>}
                      <button
                        type="button"
                        onClick={() => setCustomItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-destructive"
                        title="הסר"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-2 border border-dashed border-slate-300 rounded-lg p-2 bg-slate-50">
                    <Input
                      value={customDraft.name}
                      onChange={(e) => setCustomDraft((d) => ({ ...d, name: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomItem(); } }}
                      placeholder="שם הפריט"
                      className="h-9 flex-1 min-w-[140px] bg-white"
                    />
                    <Input
                      type="number"
                      min="1"
                      value={customDraft.quantity}
                      onChange={(e) => setCustomDraft((d) => ({ ...d, quantity: e.target.value }))}
                      className="h-9 w-16 bg-white"
                      title="כמות"
                    />
                    <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={customDraft.returnable}
                        onChange={(e) => setCustomDraft((d) => ({ ...d, returnable: e.target.checked }))}
                        className="w-3.5 h-3.5"
                      />
                      להחזרה
                    </label>
                    <Button type="button" size="sm" variant="outline" onClick={addCustomItem} disabled={!customDraft.name.trim()} className="h-9 gap-1">
                      <Plus className="w-3.5 h-3.5" />
                      הוסף
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="mb-2 block">פריטים זמינים</Label>
                  <div className="relative mb-2">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="חיפוש פריט..."
                      className="pr-9 pl-9"
                    />
                    {isSearching && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        title="נקה חיפוש"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {isSearching ? "לא נמצאו פריטים תואמים" : "אין פריטים במחסן זה"}
                      </p>
                    ) : (
                      items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg border bg-white">
                          <input
                            type="checkbox"
                            checked={!!selected[item.id]}
                            onChange={() => toggleItem(item)}
                            className="w-4 h-4"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              {isSearching && item.warehouse !== requestWarehouse && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                                  {item.warehouse}
                                </span>
                              )}
                            </div>
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
              )}
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
