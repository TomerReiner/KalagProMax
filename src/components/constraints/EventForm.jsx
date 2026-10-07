import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Phone, Trash2, UserPlus, BellRing } from "lucide-react";
import TimeInput from "@/components/TimeInput";
import { PLUGOT, PLUGA_COLORS, toDateStr } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { DEFAULT_REMINDER_OFFSET_MINUTES } from "@/lib/eventConfirmations";

const emptyForm = {
  event_type: "חיצוני",
  event_date: "",
  start_time: "08:00",
  end_time: "10:00",
  title: "",
  details: "",
  transport_pluga: "",
  transport_details: "",
  food_pluga: "",
  food_details: "",
  food_pickup_needed: false,
  responsible_plugas: [],
};

export default function EventForm({ open, onClose, onSubmit, editing }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Contacts (e.g. bus drivers). Confirmation tracking still needs a real
  // event id (editing !== null), but contacts can now be entered while
  // CREATING a new event too — they're held locally in pendingContacts until
  // the event is actually created, then persisted right after (see
  // handleSubmit). When editing an existing event, contacts still save
  // immediately as before (contacts/loadExtras).
  const [contacts, setContacts] = useState([]);
  const [pendingContacts, setPendingContacts] = useState([]);
  const [confirmations, setConfirmations] = useState([]);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", phone: "", role_label: "" });
  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          ...emptyForm,
          ...editing,
          responsible_plugas: editing.responsible_plugas || [],
          reminder_offset_minutes: editing.reminder_offset_minutes ?? DEFAULT_REMINDER_OFFSET_MINUTES,
        });
      } else {
        setForm({ ...emptyForm, event_date: toDateStr(new Date()) });
        setPendingContacts([]);
      }
      setContactForm({ name: "", phone: "", role_label: "" });
    }
  }, [open, editing]);

  const loadExtras = useCallback(async () => {
    if (!editing?.id) return;
    setLoadingExtras(true);
    try {
      const [contactData, confirmationData] = await Promise.all([
        base44.entities.EventContact.filter({ event_id: editing.id }),
        base44.entities.EventConfirmation.filter({ event_id: editing.id }),
      ]);
      setContacts(contactData);
      setConfirmations(confirmationData);
    } finally {
      setLoadingExtras(false);
    }
  }, [editing?.id]);

  useEffect(() => {
    if (open && editing?.id) loadExtras();
    if (!open || !editing) {
      setContacts([]);
      setConfirmations([]);
    }
  }, [open, editing, loadExtras]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.event_date) return;
    setSaving(true);
    try {
      // The "אנשי קשר" fields below are a separate, immediate-ish save
      // (handleAddContact persists to the API when editing, or stashes into
      // pendingContacts when creating) — they are not part of `form` and are
      // never sent by this submit directly. That's not obvious from the UI:
      // someone who types a contact's name+phone and then clicks "שמור" /
      // "הוסף אירוע" directly (a completely natural expectation — "save the
      // event" should mean "save everything I just filled in") had that
      // contact silently discarded, with the whole dialog closing right
      // after as if nothing was lost. This is what was actually behind the
      // repeated "contacts aren't saved" reports. If a complete contact is
      // sitting in the fields when the form is submitted, save/stash it too
      // before closing; if it's only half-filled, warn instead of dropping it.
      const hasName = !!contactForm.name.trim();
      const hasPhone = !!contactForm.phone.trim();
      if (hasName && hasPhone) {
        await handleAddContact();
      } else if (hasName || hasPhone) {
        window.alert(
          "שימו לב: פרטי איש הקשר שהתחלתם למלא לא נשמרו כי חסר שם או מספר טלפון (צריך למלא את שניהם, או ללחוץ 'הוסף' בנפרד)."
        );
      }

      const savedEvent = await onSubmit(form);

      // Brand-new event: the contacts added above only exist locally
      // (pendingContacts) until now, since they had no event_id to point at
      // yet. Persist them against the event id we just got back.
      if (!editing?.id && pendingContacts.length > 0 && savedEvent?.id) {
        await Promise.all(pendingContacts.map((c) =>
          base44.entities.EventContact.create({
            event_id: savedEvent.id,
            name: c.name,
            phone: c.phone,
            role_label: c.role_label,
          })
        ));
      }

      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleAddContact = async () => {
    if (!contactForm.name.trim() || !contactForm.phone.trim()) return;
    if (!editing?.id) {
      // Creating a new event: no event_id to save against yet — hold the
      // contact locally and persist it once the event itself is created
      // (see handleSubmit).
      setPendingContacts((prev) => [
        ...prev,
        {
          tempId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: contactForm.name.trim(),
          phone: contactForm.phone.trim(),
          role_label: contactForm.role_label.trim() || null,
        },
      ]);
      setContactForm({ name: "", phone: "", role_label: "" });
      return;
    }
    setSavingContact(true);
    try {
      await base44.entities.EventContact.create({
        event_id: editing.id,
        name: contactForm.name.trim(),
        phone: contactForm.phone.trim(),
        role_label: contactForm.role_label.trim() || null,
      });
      setContactForm({ name: "", phone: "", role_label: "" });
      await loadExtras();
    } catch (err) {
      // Without this, a failed create (e.g. a network hiccup) would look
      // exactly like a successful one — the fields would just sit there —
      // which is how "the contact doesn't really get saved" goes unnoticed.
      window.alert("שגיאה בהוספת איש הקשר: " + (err?.message || "שגיאה לא ידועה"));
    } finally {
      setSavingContact(false);
    }
  };

  const handleDeletePendingContact = (tempId) => {
    setPendingContacts((prev) => prev.filter((c) => c.tempId !== tempId));
  };

  // Contact-form inputs live inside the outer <form onSubmit={handleSubmit}>
  // (the whole dialog is one form). Without this, pressing Enter while
  // typing a name/phone here — the natural instinct — submits and closes
  // the ENTIRE event form instead of adding the contact, so it never
  // actually gets saved. This intercepts Enter and adds the contact instead.
  const handleContactKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddContact();
    }
  };

  const handleDeleteContact = async (id) => {
    await base44.entities.EventContact.delete(id);
    await loadExtras();
  };

  const togglePlugaConfirmation = async (pluga) => {
    if (!editing?.id) return;
    const existing = confirmations.find((c) => c.pluga === pluga);
    if (existing) {
      await base44.entities.EventConfirmation.delete(existing.id);
    } else {
      await base44.entities.EventConfirmation.create({ event_id: editing.id, pluga });
    }
    await loadExtras();
  };

  const setAllPlugotConfirmation = async (enable) => {
    if (!editing?.id) return;
    if (enable) {
      const missing = PLUGOT.filter((p) => !confirmations.some((c) => c.pluga === p));
      await Promise.all(missing.map((p) => base44.entities.EventConfirmation.create({ event_id: editing.id, pluga: p })));
    } else {
      await Promise.all(confirmations.map((c) => base44.entities.EventConfirmation.delete(c.id)));
    }
    await loadExtras();
  };

  const togglePluga = (p) => {
    setForm((prev) => ({
      ...prev,
      responsible_plugas: prev.responsible_plugas.includes(p)
        ? prev.responsible_plugas.filter((x) => x !== p)
        : [...prev.responsible_plugas, p],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "עריכת אירוע" : "הוספת אירוע"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, event_type: "חיצוני" })}
              className={cn(
                "flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors",
                form.event_type === "חיצוני"
                  ? "bg-slate-300 text-slate-900 border-slate-400"
                  : "bg-white text-muted-foreground border-border"
              )}
            >
              אירוע חיצוני
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, event_type: "פנימי" })}
              className={cn(
                "flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors",
                form.event_type === "פנימי"
                  ? "bg-slate-300 text-slate-900 border-slate-400"
                  : "bg-white text-muted-foreground border-border"
              )}
            >
              אירוע פנימי
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>תאריך *</Label>
              <Input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>כותרת *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="כותרת האירוע"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>שעת התחלה *</Label>
              <TimeInput
                value={form.start_time}
                onChange={(v) => setForm({ ...form, start_time: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>שעת סיום *</Label>
              <TimeInput
                value={form.end_time}
                onChange={(v) => setForm({ ...form, end_time: v })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>פירוט</Label>
            <Textarea
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              placeholder="פרטים נוספים (אופציונלי)"
              rows={2}
            />
          </div>

          {form.event_type === "חיצוני" && (
            <>
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-semibold text-slate-700">הסעים</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>פלוגה אחראית</Label>
                    <Select
                      value={form.transport_pluga || "none"}
                      onValueChange={(v) => setForm({ ...form, transport_pluga: v === "none" ? "" : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="טרם הוחלט" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">טרם הוחלט</SelectItem>
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
                  </div>
                  <div className="space-y-2">
                    <Label>פרטים נוספים</Label>
                    <Input
                      value={form.transport_details}
                      onChange={(e) => setForm({ ...form, transport_details: e.target.value })}
                      placeholder="פרטי הסעים"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700">אוכל</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>פלוגה אחראית</Label>
                    <Select
                      value={form.food_pluga || "none"}
                      onValueChange={(v) => setForm({ ...form, food_pluga: v === "none" ? "" : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="טרם הוחלט" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">טרם הוחלט</SelectItem>
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
                  </div>
                  <div className="space-y-2">
                    <Label>פרטים נוספים</Label>
                    <Input
                      value={form.food_details}
                      onChange={(e) => setForm({ ...form, food_details: e.target.value })}
                      placeholder="פרטי אוכל"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="food_pickup_needed"
                    checked={!!form.food_pickup_needed}
                    onCheckedChange={(v) => setForm({ ...form, food_pickup_needed: !!v })}
                  />
                  <Label htmlFor="food_pickup_needed" className="cursor-pointer font-normal">
                    צריך למשוך אוכל (למשל מקיבוץ עינת) — הפלוגה האחראית תקבל תזכורת יום לפני ושעה וחצי לפני
                  </Label>
                </div>
              </div>
            </>
          )}

          {form.event_type === "פנימי" && (
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">פלוגות אחראיות</p>
              <div className="flex flex-wrap gap-2">
                {PLUGOT.map((p) => {
                  const selected = form.responsible_plugas.includes(p);
                  const color = PLUGA_COLORS[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePluga(p)}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5",
                        selected
                          ? cn(color?.bg, color?.text, "border-transparent")
                          : "bg-white text-muted-foreground border-border hover:bg-muted"
                      )}
                    >
                      <span className={cn("w-2 h-2 rounded-full", !selected && color?.dot)} />
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-slate-700" />
              <p className="text-sm font-semibold text-slate-700">אנשי קשר ואישורי הגעה</p>
              {loadingExtras && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            </div>

            {editing?.id && (
              <>
                <div className="space-y-2">
                  <Label>שעות לפני האירוע לשליחת תזכורת</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.reminder_offset_minutes ? Math.round(form.reminder_offset_minutes / 60 * 10) / 10 : ""}
                    onChange={(e) => setForm({ ...form, reminder_offset_minutes: e.target.value ? Math.round(Number(e.target.value) * 60) : null })}
                    placeholder="1.5"
                  />
                  <p className="text-xs text-muted-foreground">
                    לדוגמה 1.5 שעות = תזכורת לאישור תישלח שעה וחצי לפני מועד האירוע. יש לשמור את הטופס כדי לעדכן.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>פלוגות שצריכות לאשר</Label>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setAllPlugotConfirmation(true)} className="text-xs text-blue-600 hover:underline">
                        בחר הכל
                      </button>
                      <span className="text-xs text-muted-foreground">/</span>
                      <button type="button" onClick={() => setAllPlugotConfirmation(false)} className="text-xs text-slate-500 hover:underline">
                        נקה הכל
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PLUGOT.map((p) => {
                      const selected = confirmations.some((c) => c.pluga === p);
                      const confirmedByPluga = confirmations.find((c) => c.pluga === p)?.confirmed;
                      const color = PLUGA_COLORS[p];
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => togglePlugaConfirmation(p)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5",
                            selected
                              ? cn(color?.light, color?.border)
                              : "bg-white border-border text-muted-foreground hover:bg-slate-50"
                          )}
                        >
                          {p}
                          {selected && (confirmedByPluga ? " ✓" : "")}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    כל פלוגה שנבחרה תראה תזכורת ותוכל לאשר בעמוד "המשימות שלי" שלה.
                  </p>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>אנשי קשר (למשל נהג הסעה)</Label>
              {(editing?.id ? contacts : pendingContacts).length > 0 && (
                <div className="space-y-1.5">
                  {(editing?.id ? contacts : pendingContacts).map((c) => (
                    <div key={c.id || c.tempId} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 bg-white">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {c.name}
                          {c.role_label && <span className="text-xs text-muted-foreground"> · {c.role_label}</span>}
                        </p>
                        <a href={`tel:${c.phone}`} className="text-xs text-blue-600 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {c.phone}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => (editing?.id ? handleDeleteContact(c.id) : handleDeletePendingContact(c.tempId))}
                        className="shrink-0 p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 items-end">
                <div className="space-y-1 flex-1 min-w-[100px]">
                  <Input
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    onKeyDown={handleContactKeyDown}
                    placeholder="שם"
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-[100px]">
                  <Input
                    type="tel"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    onKeyDown={handleContactKeyDown}
                    placeholder="טלפון"
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-[100px]">
                  <Input
                    value={contactForm.role_label}
                    onChange={(e) => setContactForm({ ...contactForm, role_label: e.target.value })}
                    onKeyDown={handleContactKeyDown}
                    placeholder="תפקיד (אופציונלי)"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddContact}
                  disabled={savingContact || !contactForm.name.trim() || !contactForm.phone.trim()}
                  className="gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  הוסף
                </Button>
              </div>
              {!editing?.id && (
                <p className="text-xs text-muted-foreground">
                  אנשי הקשר יישמרו יחד עם האירוע. אישורי הגעה ותזכורות יהיו זמינים לאחר השמירה (פתח לעריכה שוב).
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              ביטול
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "שומר..." : editing ? "שמור שינויים" : "הוסף אירוע"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}