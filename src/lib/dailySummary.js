// "סיכום מסדר" (daily_summaries) — shared by the standalone page
// (src/pages/DailySummary.jsx) and the Klaf page's embedded card
// (src/components/klaf/KlafSummary.jsx), which used to keep duplicated
// copies of these helpers.
//
// One day = ONE summary. Several rows can exist for the same summary_date
// (two people each pressed "סיכום חדש" the same day); every screen shows
// them merged into a single summary, and saving that day writes all entries
// back into one row and deletes the others — so a split day heals itself
// the first time anyone edits it.
import { base44 } from "@/api/base44Client";
import { PLUGOT, formatHebrewDate } from "@/lib/constants";

export function parseEntries(entries) {
  if (!entries) return [];
  if (Array.isArray(entries)) return entries;
  if (typeof entries === "string") {
    try {
      return JSON.parse(entries);
    } catch {
      return [];
    }
  }
  return [];
}

// An entry's areas — the current `areas` array, or an older entry's single
// `area` wrapped in an array.
export function entryAreas(e) {
  if (Array.isArray(e.areas)) return e.areas;
  if (e.area) return [e.area];
  return [];
}

// rows (any order) → [{ date, rows, entries }] newest date first, entries of
// same-day rows concatenated in creation order.
export function groupByDate(rows) {
  const byDate = new Map();
  [...rows]
    .sort((a, b) => String(a.created_date || "").localeCompare(String(b.created_date || "")))
    .forEach((r) => {
      const date = String(r.summary_date).slice(0, 10);
      if (!byDate.has(date)) byDate.set(date, { date, rows: [], entries: [] });
      const g = byDate.get(date);
      g.rows.push(r);
      g.entries.push(...parseEntries(r.entries));
    });
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

// Plugot that appear on the summary, in PLUGOT order.
export function plugotIn(entries) {
  return PLUGOT.filter((p) => entries.some((e) => e.pluga === p));
}

// WhatsApp-ready text. With `pluga`, only that pluga's entries.
export function summaryText(date, entries, pluga = null) {
  const list = pluga ? entries.filter((e) => e.pluga === pluga) : entries;
  let text = `סיכום מסדר - ${formatHebrewDate(date)}${pluga ? ` - פלוגת ${pluga}` : ""}\n\n`;
  list.forEach((e) => {
    const header = entryAreas(e).join(", ") + (!pluga && e.pluga ? ` (${e.pluga})` : "");
    text += `${header}:\n`;
    if (e.notes) text += `${e.notes}\n`;
    text += `\n`;
  });
  return text.trimEnd();
}

// Saves a day's (possibly merged) entries as a single row: updates the first
// existing row, deletes any other rows of that date, or creates one.
export async function saveDaySummary(date, existingRows, entries) {
  const [keep, ...extra] = existingRows || [];
  if (keep) {
    await base44.entities.DailySummary.update(keep.id, { entries });
    for (const r of extra) await base44.entities.DailySummary.delete(r.id);
  } else {
    await base44.entities.DailySummary.create({ summary_date: date, entries });
  }
}
