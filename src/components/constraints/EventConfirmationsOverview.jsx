import React, { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Phone, CheckCircle2, Circle, ClipboardCheck } from "lucide-react";
import { PLUGOT, PLUGA_COLORS, formatHebrewDate } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { getConfirmationState, CONFIRMATION_STATE_LABELS } from "@/lib/eventConfirmations";

const STATE_STYLES = {
  confirmed: "bg-green-100 text-green-700 border-green-300",
  escalated: "bg-red-100 text-red-700 border-red-300",
  reminder: "bg-amber-100 text-amber-700 border-amber-300",
  upcoming: "bg-slate-100 text-slate-600 border-slate-300",
};

// Admin oversight dashboard: every event that has at least one pluga
// configured to confirm it, showing per-pluga confirmed/unconfirmed status
// across all plugot in one place (request: "admin oversight screen showing
// status across all plugot - who's confirmed, who hasn't made contact").
export default function EventConfirmationsOverview({ open, onClose, events }) {
  const [confirmations, setConfirmations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, forceTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [confirmationData, contactData] = await Promise.all([
        base44.entities.EventConfirmation.list("-created_date", 1000),
        base44.entities.EventContact.list("-created_date", 500),
      ]);
      setConfirmations(confirmationData);
      setContacts(contactData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Keep the reminder/escalation coloring live while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => forceTick((n) => n + 1), 60000);
    return () => clearInterval(interval);
  }, [open]);

  const eventsWithConfirmations = useMemo(() => {
    const eventIds = new Set(confirmations.map((c) => c.event_id));
    return events
      .filter((e) => eventIds.has(e.id))
      .sort((a, b) => `${a.event_date}${a.start_time}`.localeCompare(`${b.event_date}${b.start_time}`));
  }, [events, confirmations]);

  const toggleConfirmed = async (confirmation) => {
    await base44.entities.EventConfirmation.update(confirmation.id, {
      confirmed: !confirmation.confirmed,
      confirmed_at: !confirmation.confirmed ? new Date().toISOString() : null,
    });
    await load();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            מעקב אישורי הגעה
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : eventsWithConfirmations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            אין אירועים עם אישורי הגעה מוגדרים. ניתן להגדיר אנשי קשר ואישורים בעריכת אירוע.
          </p>
        ) : (
          <div className="space-y-4">
            {eventsWithConfirmations.map((event) => {
              const eventConfirmations = confirmations
                .filter((c) => c.event_id === event.id)
                .sort((a, b) => PLUGOT.indexOf(a.pluga) - PLUGOT.indexOf(b.pluga));
              const eventContacts = contacts.filter((c) => c.event_id === event.id);

              return (
                <div key={event.id} className="rounded-xl border border-border bg-white p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold text-sm">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatHebrewDate(event.event_date)} · {event.start_time}
                        {event.end_time ? ` - ${event.end_time}` : ""}
                      </p>
                    </div>
                    {eventContacts.length > 0 && (
                      <div className="flex flex-col gap-1 items-end">
                        {eventContacts.map((c) => (
                          <a key={c.id} href={`tel:${c.phone}`} className="text-xs text-blue-600 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {c.name} ({c.phone})
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {eventConfirmations.map((c) => {
                      const state = getConfirmationState(event, c);
                      return (
                        <button
                          key={c.id}
                          onClick={() => toggleConfirmed(c)}
                          title={CONFIRMATION_STATE_LABELS[state]}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                            STATE_STYLES[state]
                          )}
                        >
                          {c.confirmed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                          <span className={cn("w-2 h-2 rounded-full", PLUGA_COLORS[c.pluga]?.dot)} />
                          {c.pluga}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
