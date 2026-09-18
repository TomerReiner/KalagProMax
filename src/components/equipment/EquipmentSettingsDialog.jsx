import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

export default function EquipmentSettingsDialog({ open, onClose, settings, onSave }) {
  const [klafUsers, setKlafUsers] = useState([]);
  const [form, setForm] = useState({
    responsible_klaf_id: "",
    responsible_klaf_name: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        responsible_klaf_id: settings?.responsible_klaf_id || "",
        responsible_klaf_name: settings?.responsible_klaf_name || "",
      });
      base44.entities.User
        .list()
        .then((users) => setKlafUsers(users.filter((u) => u.role === "קלפ")))
        .catch(() => {});
    }
  }, [open, settings]);

  const handleResponsibleChange = (userId) => {
    const u = klafUsers.find((u) => u.id === userId);
    setForm((prev) => ({
      ...prev,
      responsible_klaf_id: userId,
      responsible_klaf_name: u?.full_name || u?.email || "",
    }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[450px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>הגדרות משיכות ציוד</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>קלף אחראי</Label>
            <Select
              value={form.responsible_klaf_id}
              onValueChange={handleResponsibleChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר קלף אחראי" />
              </SelectTrigger>
              <SelectContent>
                {klafUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email}
                    {u.pluga ? ` (${u.pluga})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "שומר..." : "שמור"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}