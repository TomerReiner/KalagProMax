// Shared logic for the event contact / bus-confirmation feature. The
// reminder → escalation timing is computed live on the client (no server
// cron): a pluga's confirmation for an event moves through four states as
// the clock passes the admin-configured reminder offset and then the
// event's own start time.
export const DEFAULT_REMINDER_OFFSET_MINUTES = 90;

export function getEventDateTime(event) {
  if (!event?.event_date) return null;
  const time = event.start_time || "00:00";
  const d = new Date(`${event.event_date}T${time}:00`);
  return isNaN(d.getTime()) ? null : d;
}

// 'confirmed' | 'escalated' (past start time, still unconfirmed) |
// 'reminder' (past the reminder threshold, still unconfirmed) |
// 'upcoming' (nothing to show yet)
export function getConfirmationState(event, confirmation, now = new Date()) {
  if (confirmation?.confirmed) return "confirmed";
  const eventDateTime = getEventDateTime(event);
  if (!eventDateTime) return "upcoming";
  const offsetMinutes = event.reminder_offset_minutes ?? DEFAULT_REMINDER_OFFSET_MINUTES;
  const reminderThreshold = new Date(eventDateTime.getTime() - offsetMinutes * 60000);
  if (now >= eventDateTime) return "escalated";
  if (now >= reminderThreshold) return "reminder";
  return "upcoming";
}

export const CONFIRMATION_STATE_LABELS = {
  confirmed: "אושר",
  escalated: "טרם אושר - חורג מהמועד",
  reminder: "יש לאשר בקרוב",
  upcoming: "טרם הגיע מועד התזכורת",
};
