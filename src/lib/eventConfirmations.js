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

// Food-pickup reminder (e.g. sandwiches from Kibbutz Einat for an external
// event) — events.food_pickup_needed, set from the event form. No separate
// table/permission: this just adds reminder urgency to the "אוכל" task
// already shown on the Klaf page wherever event.food_pluga matches the
// viewer's pluga. Two fixed thresholds (not admin-configurable, unlike the
// confirmation reminder above) — a day-before nudge, then an urgent window
// starting 90 minutes out:
// 'overdue' (past start, not completed) | 'urgent' (<=90 min out) |
// 'reminder' (<=24h out) | 'upcoming' (nothing to show yet) | null (the
// event doesn't need a food pickup at all).
const FOOD_PICKUP_DAY_BEFORE_MINUTES = 24 * 60;
const FOOD_PICKUP_URGENT_MINUTES = 90;

export function getFoodPickupState(event, now = new Date()) {
  if (!event?.food_pickup_needed) return null;
  const eventDateTime = getEventDateTime(event);
  if (!eventDateTime) return "upcoming";
  const urgentThreshold = new Date(eventDateTime.getTime() - FOOD_PICKUP_URGENT_MINUTES * 60000);
  const reminderThreshold = new Date(eventDateTime.getTime() - FOOD_PICKUP_DAY_BEFORE_MINUTES * 60000);
  if (now >= eventDateTime) return "overdue";
  if (now >= urgentThreshold) return "urgent";
  if (now >= reminderThreshold) return "reminder";
  return "upcoming";
}

export const FOOD_PICKUP_STATE_LABELS = {
  overdue: "המועד עבר - יש למשוך אוכל",
  urgent: "למשוך אוכל בקרוב",
  reminder: "לזכור למשוך אוכל",
  upcoming: "",
};
