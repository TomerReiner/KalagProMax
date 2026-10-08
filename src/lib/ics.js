// "הוסף ליומן" — builds an RFC 5545 .ics file (Google Calendar, Outlook,
// iPhone all import it) from events / constraints and triggers a download.
// Times are written as floating local times (no TZID), which is what a
// calendar app shows as-is — the app's times are Israel-local already.
import { dateOnly } from "@/lib/battalion";

function stamp(dateStr, hhmm) {
  const [y, m, d] = dateStr.split("-");
  const [hh, mm] = (hhmm || "00:00").split(":");
  return `${y}${m}${d}T${hh.padStart(2, "0")}${(mm || "00").padStart(2, "0")}00`;
}

function nextDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// RFC 5545 text escaping + 75-octet line folding (approximated by chars).
function esc(text) {
  return String(text || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function fold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 70) {
    out.push(rest.slice(0, 70));
    rest = ` ${rest.slice(70)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

/** items: [{ uid, title, date: "YYYY-MM-DD", start: "HH:MM", end: "HH:MM", description, location }] */
export function buildICS(items, calendarName = "Binder Done That") {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Binder Done That//HE",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(calendarName)}`,
  ];
  items.forEach((it) => {
    const date = dateOnly(it.date);
    const endDate = it.end && it.start && it.end <= it.start ? nextDay(date) : date; // crosses midnight
    lines.push(
      "BEGIN:VEVENT",
      `UID:${it.uid}@binder-done-that`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(date, it.start)}`,
      `DTEND:${stamp(endDate, it.end || it.start)}`,
      fold(`SUMMARY:${esc(it.title)}`),
      ...(it.description ? [fold(`DESCRIPTION:${esc(it.description)}`)] : []),
      ...(it.location ? [fold(`LOCATION:${esc(it.location)}`)] : []),
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(items, filename, calendarName) {
  const blob = new Blob([buildICS(items, calendarName)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function eventToIcsItem(e) {
  const roles = e.event_type === "חיצוני"
    ? [`הסעים: ${e.transport_pluga || "טרם נקבע"}`, `אוכל: ${e.food_pluga || "טרם נקבע"}`]
    : [`פלוגות אחראיות: ${(e.responsible_plugas || []).join(", ") || "טרם נקבע"}`];
  return {
    uid: `event-${e.id}`,
    title: e.title,
    date: dateOnly(e.event_date),
    start: e.start_time,
    end: e.end_time,
    description: [e.details, ...roles].filter(Boolean).join("\n"),
  };
}
