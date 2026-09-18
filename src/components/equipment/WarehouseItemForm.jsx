import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function WarehouseItemForm({ open, onClose, onSubmit, warehouse, editingItem }) {
  const [form, setForm] = useState({ name: "", quantity: 0, returnable: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        editingItem
          ? { name: editingItem.name, quantity: editingItem.quantity, returnable: editingItem.returnable || false }
          : { name: "", quantity: 0, returnable: false }
      );
    }
  }, [open, editingItem]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    try {
      await onSubmit({ ...form, warehouse });
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