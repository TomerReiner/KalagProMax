import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Truck, UtensilsCrossed, Users2, Plus, Trash2, X, Shield } from "lucide-react";
import { PLUGOT, PLUGA_COLORS, toDateStr, formatHebrewDate } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { PERMISSIONS, plugotFor, hasPermission } from "@/lib/permissions";

const STATUS_LABELS = { "ממתין": "ממתין", "הוזמן": "הוזמן", "בוטל": "בוטל" };
const MEAL_TYPES = ["צהריים", "ערב"];

export default function Delegations() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [myPermissions, setMyPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    base44.entities.UserPermission.filter({ user_id: user.id })
      .then(setMyPermissions)
      .catch(() => setMyPermissions([]))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const canPlaybox = hasPermission(myPermissions, "playbox_orders");
  const canRegulators = plugotFor(myPermissions, "meal_regulators").length > 0;
  const canFoodTravel = plugotFor(myPermissions, "food_travel").length > 0;

  useEffect(() => {
    if (tab) return;
    if (canPlaybox) setTab("playbox");
    else if (canRegulators) setTab("regulators");
    else if (canFoodTravel) setTab("food_travel");
  }, [tab, canPlaybox, canRegulators, canFoodTravel]);

  if (!user || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canPlaybox && !canRegulators && !canFoodTravel) {
    return (
      <div className="text-center py-20 text-muted-foreground space-y-2">
        <Shield className="w-10 h-10 mx-auto opacity-40" />
        <p className="text-sm font-medium">אין לך הרשאות מואצלות</p>
        <p className="text-xs">אדמין יכול להעניק הרשאות דרך "ניהול משתמשים ובקשות גישה" → משתמשים</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold text-center">האצלות</h1>
      <Tabs value={tab || ""} onValueChange={setTab}>
        <TabsList className="w-full flex-wrap h-auto">
          {canPlaybox && (
            <TabsTrigger value="playbox" className="gap-1.5">
              <Truck className="w-4 h-4" />
              {PERMISSIONS.playbox_orders.label}
            </TabsTrigger>
          )}
          {canRegulators && (
            <TabsTrigger value="regulators" className="gap-1.5">
              <Users2 className="w-4 h-4" />
              {PERMISSIONS.meal_regulators.label}
            </TabsTrigger>
          )}
          {canFoodTravel && (
            <TabsTrigger value="food_travel" className="gap-1.5">
              <UtensilsCrossed className="w-4 h-4" />
              {PERMISSIONS.food_travel.label}
            </TabsTrigger>
          )}
        </TabsList>
        {canPlaybox && (
          <TabsContent value="playbox">
            <PlayboxTab />
          </TabsContent>
        )}
        {canRegulators && (
          <TabsContent value="regulators">
            <RegulatorsTab allowedPlugot={plugotFor(myPermissions, "meal_regulators")} />
          </TabsContent>
        )}
        {canFoodTravel && (
          <TabsContent value="food_travel">
            <FoodTravelTab allowedPlugot={plugotFor(myPermissions, "food_travel")} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// פלייבוקס — כל הפלוגות, למי שמחזיק את ההרשאה הכלל-ארגונית
// ---------------------------------------------------------------------------
function PlayboxTab() {
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
    <div className="space-y-4 mt-3">
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

// ---------------------------------------------------------------------------
// ניהול מווסתים — פר פלוגה (מתוך אלו שהמשתמש הורשה עבורן), פר יום ופר ארוחה
// ---------------------------------------------------------------------------
function RegulatorsTab({ allowedPlugot }) {
  const { toast } = useToast();
  const [pluga, setPluga] = useState(allowedPlugot[0]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState({ "צהריים": "", "ערב": "" });
  const dateStr = toDateStr(selectedDate);

  const load = useCallback(async () => {
    if (!pluga) return;
    setLoading(true);
    try {
      const data = await base44.entities.MealRegulator.filter({ pluga, meal_date: dateStr });
      setRows(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [pluga, dateStr]);

  useEffect(() => { load(); }, [load]);

  const rowFor = (mealType) => rows.find((r) => r.meal_type === mealType) || null;

  const saveNames = async (mealType, names) => {
    try {
      const existing = rowFor(mealType);
      if (existing) {
        await base44.entities.MealRegulator.update(existing.id, { names });
      } else {
        await base44.entities.MealRegulator.create({ pluga, meal_date: dateStr, meal_type: mealType, names });
      }
      await load();
    } catch (err) {
      toast({ title: "שגיאה בשמירה", description: err.message, variant: "destructive" });
    }
  };

  const addName = (mealType) => {
    const name = (newName[mealType] || "").trim();
    if (!name) return;
    const current = rowFor(mealType)?.names || [];
    saveNames(mealType, [...current, name]);
    setNewName((n) => ({ ...n, [mealType]: "" }));
  };

  const removeName = (mealType, idx) => {
    const current = rowFor(mealType)?.names || [];
    saveNames(mealType, current.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4 mt-3">
      <div className="flex items-center gap-2 flex-wrap">
        {allowedPlugot.length > 1 && (
          <Select value={pluga} onValueChange={setPluga}>
            <SelectTrigger className="h-9 text-sm w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {allowedPlugot.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Input
          type="date"
          value={dateStr}
          onChange={(e) => setSelectedDate(new Date(e.target.value + "T00:00:00"))}
          className="h-9 text-sm w-40"
        />
        <span className="text-xs text-muted-foreground">{formatHebrewDate(selectedDate)}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {MEAL_TYPES.map((mealType) => {
            const names = rowFor(mealType)?.names || [];
            return (
              <div key={mealType} className="border rounded-lg p-3 bg-white space-y-2">
                <p className="text-sm font-medium">{mealType}</p>
                <div className="space-y-1.5">
                  {names.length === 0 && <p className="text-xs text-muted-foreground">לא נקבעו מווסתים</p>}
                  {names.map((n, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-slate-50 rounded px-2 py-1">
                      <span>{n}</span>
                      <button onClick={() => removeName(mealType, i)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <Input
                    placeholder="שם"
                    value={newName[mealType]}
                    onChange={(e) => setNewName((n) => ({ ...n, [mealType]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") addName(mealType); }}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="outline" onClick={() => addName(mealType)} className="shrink-0">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// משיכות מזון לנסיעות — רישום בלבד, ללא אישור
// ---------------------------------------------------------------------------
function FoodTravelTab({ allowedPlugot }) {
  const { toast } = useToast();
  const [pluga, setPluga] = useState(allowedPlugot[0]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ travel_date: toDateStr(new Date()), destination: "", headcount: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = allowedPlugot.length === 1
        ? await base44.entities.FoodTravelRequest.filter({ pluga })
        : (await base44.entities.FoodTravelRequest.list("-travel_date", 200)).filter((r) => allowedPlugot.includes(r.pluga));
      setEntries([...rows].sort((a, b) => (b.travel_date || "").localeCompare(a.travel_date || "")));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [pluga, allowedPlugot]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.destination.trim()) return;
    setSaving(true);
    try {
      await base44.entities.FoodTravelRequest.create({
        pluga,
        travel_date: form.travel_date,
        destination: form.destination.trim(),
        headcount: form.headcount ? Number(form.headcount) : null,
        notes: form.notes.trim() || null,
      });
      setForm((f) => ({ ...f, destination: "", headcount: "", notes: "" }));
      await load();
      toast({ title: "הבקשה נרשמה", duration: 2000 });
    } catch (err) {
      toast({ title: "שגיאה ברישום", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry) => {
    try {
      await base44.entities.FoodTravelRequest.delete(entry.id);
      await load();
    } catch (err) {
      toast({ title: "שגיאה במחיקה", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 mt-3">
      <div className="border rounded-lg p-3 bg-white space-y-2">
        <p className="text-sm font-medium">רישום בקשת מזון לנסיעה</p>
        <div className="grid grid-cols-2 gap-2">
          {allowedPlugot.length > 1 ? (
            <Select value={pluga} onValueChange={setPluga}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {allowedPlugot.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : <div className="flex items-center text-sm font-medium px-1">{pluga}</div>}
          <Input type="date" value={form.travel_date} onChange={(e) => setForm((f) => ({ ...f, travel_date: e.target.value }))} className="h-9 text-sm" />
        </div>
        <Input placeholder="יעד (למשל: קיבוץ עינת)" value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} className="h-9 text-sm" />
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <Input type="number" min="1" placeholder="כמות אנשים" value={form.headcount} onChange={(e) => setForm((f) => ({ ...f, headcount: e.target.value }))} className="h-9 text-sm" />
          <Input placeholder="הערות (אופציונלי)" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="h-9 text-sm" />
        </div>
        <Button size="sm" onClick={handleAdd} disabled={saving || !form.destination.trim()} className="w-full gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          רשום
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : entries.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">אין בקשות רשומות</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="border rounded-lg p-3 bg-white flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", PLUGA_COLORS[e.pluga]?.light)}>{e.pluga}</span>
                  <span className="text-sm font-medium">{e.destination}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {e.travel_date}{e.headcount ? ` · ${e.headcount} אנשים` : ""}{e.notes ? ` · ${e.notes}` : ""}
                </p>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => handleDelete(e)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
