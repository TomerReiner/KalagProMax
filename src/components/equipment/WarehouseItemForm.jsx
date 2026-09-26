import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function WarehouseItemForm({ open, onClose, onSubmit, warehouse, editingItem, canSetTarget }) {
  const [form, setForm] = useState({ name: "", quantity: 0, returnable: false, target_quantity: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        editingItem
          ? {
              name: editingItem.name,
              quantity: editingItem.quantity,
              returnable: editingItem.returnable || false,
              target_quantity: editingItem.target_quantity || 0,
            }
          : { name: "", quantity: 0, returnable: false, target_quantity: 0 }
      );
    }
  }, [open, editingItem]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    try {
      // Only send target_quantity when this user is actually allowed to set
      // it (canSetTarget) — otherwise a regular קלפ editing just the name or
      // quantity would silently overwrite whatever target someone else
      // already configured, since it isn't in their form state to begin with.
      const { target_quantity, ...rest } = form;
      const payload = canSetTarget ? { ...rest, target_quantity, warehouse } : { ...rest, warehouse };
      await onSubmit(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[400px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editingItem ? "עריכת פריט" : "הוספת פריט"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>שם פריט *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="שם הפריט"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>כמות *</Label>
            <Input
              type="number"
              min="0"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              required
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.returnable}
              onCheckedChange={(v) => setForm({ ...form, returnable: v })}
              id="returnable"
            />
            <Label htmlFor="returnable">ציוד שצריך להחזיר למחסן</Label>
          </div>
          {canSetTarget && (
            <div className="space-y-2">
              <Label>כמות יעד (אופציונלי)</Label>
              <Input
                type="number"
                min="0"
                value={form.target_quantity}
                onChange={(e) => setForm({ ...form, target_quantity: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                כשמשיכת ציוד תוריד את הכמות מתחת ליעד הזה, המערכת תציע ליצור בקשת הזמנה אוטומטית מהפלייבוקס להשלמה.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              ביטול
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}