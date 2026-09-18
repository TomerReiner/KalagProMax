import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLUGOT } from "@/lib/constants";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function WithdrawalForm({ open, onClose, warehouse, items, userPluga, onDone }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState({});
  const [pluga, setPluga] = useState(userPluga || "");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSelected({});
      setPluga(userPluga || "");
      setExpectedReturnDate("");
      setNotes("");
      setError("");
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

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      setError("בחר לפחות פריט אחד");
      return;
    }
    if (!pluga) {
      setError("בחר פלוגה");
      return;
    }
    setSaving(true);
    setError("");
    try {
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
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "שגיאה בשליחת הבקשה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto" dir="rtl">
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
                      {p}
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
          <Button onClick={handleSubmit} disabled={saving}>
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
      </DialogContent>
    </Dialog>
  );
}