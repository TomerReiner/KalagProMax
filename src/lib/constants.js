export const PLUGOT = ["פארן", "בשור", "צין", "רמון", "תמר"];

// The 3 physical equipment warehouses (src/pages/Equipment.jsx). Exported
// from here (rather than kept as a local const in Equipment.jsx, as it used
// to be) so Playbox.jsx can offer the same 3 destinations when marking an
// order "התקבל" — see supabase/migrations/0010_playbox_orders_destination_warehouse.sql.
// "מחסן קליר" was renamed from "מחסן לוגיסטי" — see
// supabase/migrations/0018_warehouse_rename_and_playbox_order_approval.sql,
// which renames every existing row's value to match (this string is used
// directly as the stored value throughout the app, not just a display
// label, so the rename had to happen in the data too, not just here).
export const WAREHOUSES = ["מכולה", "מחסן קרביץ", "מחסן קליר"];

export const LOCATIONS = [
  "מגורים כללי",
  "מגורי בנים",
  "מגורי בנות",
  "ספסלים",
  "שולחנות ספרייה",
  "פינת פריסה",
  "פינת קקס",
  "שביל",
  "פינת עישון",
  "כניסה למגורי בנים",
  "כניסה למגורי בנות",
  "רחבת רמון",
  "פינת ישיבה מאחורי הקמנים",
  "דקצו",
  "איזור שקם",
  "מתחם קמנים חיצוני",
  "שבילים מקיפי מתחם קמנים",
  "שביל צמוד למדרכה",
  "דשא כניסה למתחם",
  "פינת גלחצ",
  "מתחם קמנים",
  "כיתות",
];

export const PLUGA_COLORS = {
  "פארן": { bg: "bg-blue-500", text: "text-white", light: "bg-blue-100", border: "border-blue-400", dot: "bg-blue-500" },
  "בשור": { bg: "bg-emerald-500", text: "text-white", light: "bg-emerald-100", border: "border-emerald-400", dot: "bg-emerald-500" },
  "צין": { bg: "bg-slate-900", text: "text-white", light: "bg-slate-200", border: "border-slate-600", dot: "bg-slate-900" },
  "רמון": { bg: "bg-red-500", text: "text-white", light: "bg-red-100", border: "border-red-400", dot: "bg-red-500" },
  "תמר": { bg: "bg-yellow-400", text: "text-slate-900", light: "bg-yellow-100", border: "border-yellow-400", dot: "bg-yellow-400" },
};

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function formatHebrewDate(date) {
  if (typeof date === "string") {
    const parts = date.split("-").map(Number);
    date = new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const dayName = DAY_NAMES[date.getDay()];
  return `יום ${dayName} ה-${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const SHOTAF_OPTIONS = ["טרם הוחלט", ...PLUGOT];

export const SHOTAF_TIMES = {
  morning_assembly_plugas: {
    start: "07:40", end: "08:00",
    excludeDays: [5, 6],
    overrides: { 4: { start: "07:10" } }
  },
  frisa_morning: { start: "15:00", end: "16:00", excludeDays: [5, 6] },
  noon_cleaning: { start: "12:00", end: "13:30", excludeDays: [5, 6] },
  evening_cleaning: { start: "18:00", end: "19:30", excludeDays: [5, 6] },
};

export function getShotafTime(field, date) {
  const config = SHOTAF_TIMES[field];
  if (!config) return null;
  const day = date.getDay();
  if (config.excludeDays?.includes(day)) return null;
  let start = config.start;
  let end = config.end;
  if (config.overrides?.[day]) {
    start = config.overrides[day].start;
  }
  return { start, end };
}

export const SHOTAF_FIELD_LABELS = {
  morning_assembly_plugas: "מסדר בוקר",
  frisa_morning: "משיכת פינת פריסה",
  noon_cleaning: "ניקוי צהריים - פינת פריסה ושירותים",
  evening_cleaning: "ניקוי ערב - פינת פריסה ושירותים",
};

export const EVENT_COLORS = {
  bg: "bg-slate-300",
  text: "text-slate-900",
  light: "bg-slate-100",
  border: "border-slate-400",
  dot: "bg-slate-400",
};