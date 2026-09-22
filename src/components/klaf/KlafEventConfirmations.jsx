import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Phone, CheckCircle2, Circle, BellRing, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getConfirmationState } from "@/lib/eventConfirmations";

const STATE_STYLES = {
  confirmed: "bg-green-50 border-green-300",
  escalated: "bg-red-50 border-red-400",
  reminder: "bg-amber-50 border-amber-300",
  upcoming: "bg-white border-border",
};

// Klaf-facing side of the bus/event confirmation feature: for each of today's
// events that this pluga needs to confirm, show the contact person (with a
// tel: call button) and a confirm checkbox. Card styling escalates
// automatically as the clock passes the reminder threshold and then the
// event's own start time — computed live client-side, no push notification.
export default function KlafEventConfirmations({ events, pluga, confirmations, contacts, onChange }) {
  const [, forceTick] = useState(0);
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  if (!confirmations || confirmations.length === 0) return null;

  const rows = confirmations
    .map((c) => ({ confirmation: c, event: events.find((e) => e.id === c.event_id) }))
    .filter((r) => r.event)
    .sort((a, b) => (a.event.start_time || "").localeCompare(b.event.start_time || ""));

  const toggleConfirmed = async (confirmation) => {
    setToggling(confirmation.id);
    try {
      await base44.entities.EventConfirmation.update(confirmation.id, {
        confirmed: !confirmation.confirmed,
        confirmed_by: pluga,
        confirmed_at: !confirmation.confirmed ? new Date().toISOString() : null,
      });
      await onChange?.();
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">אישורי הגעה</h2>
      <div className="space-y-2">
        {rows.map(({ confirmation, event }) => {
          const state = getConfirmationState(event, confirmation);
          const eventContacts = contacts.filter((c) => c.event_id === event.id);
          return (
            <div key={confirmation.id} className={cn("rounded-xl border-2 p-3 space-y-2", STATE_STYLES[state])}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{event.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {event.start_time}{event.end_time ? ` - ${event.end_time}` : ""}
                  </p>
                </div>
                {state === "escalated" && !confirmation.confirmed && (
                  <span className="flex items-center gap-1 text-xs font-medium text-red-700">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    חורג מהמועד
                  </span>
                )}
                {state === "reminder" && !confirmation.confirmed && (
                  <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                    <BellRing className="w-3.5 h-3.5" />
                    יש לאשר
                  </span>
                )}
              </div>

              {eventContacts.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {eventContacts.map((c) => (
                    <a key={c.id} href={`tel:${c.phone}`} className="text-xs text-blue-600 flex items-center gap-1 font-medium">
                      <Phone className="w-3.5 h-3.5" />
                      {c.name}
                      {c.role_label ? ` (${c.role_label})` : ""}
                    </a>
                  ))}
                </div>
              )}

              <button
                onClick={() => toggleConfirmed(confirmation)}
                disabled={toggling === confirmation.id}
                className={cn(
                  "flex items-center gap-2 text-sm font-medium rounded-lg px-3 py-1.5 border transition-colors",
                  confirmation.confirmed
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                )}
              >
                {confirmation.confirmed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                {confirmation.confirmed ? "אושר" : "אשר הגעה"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
