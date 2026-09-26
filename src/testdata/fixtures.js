// Test-mode fixture data — the in-memory equivalent of
// supabase/test-data/seed_test_playground.sql +
// refresh_test_confirmations.sql, ported to plain JS so it can run entirely
// client-side with no Supabase project involved at all.
//
// Every date/time below is computed fresh from `new Date()` each time
// buildFixtures() runs (page load, or "reset test data"), so — unlike the
// SQL scripts — there's nothing to remember to re-run: it's always
// "relative to right now," automatically.
//
// Ids reuse the same fixed prefixes as the SQL scripts purely so the two
// stay easy to cross-reference; they don't need to be globally unique here
// since this store only ever exists in one browser tab's memory.
//
// Titles here are plain — no "[TEST]" prefix. This data only ever exists in
// this browser tab's memory (see src/testdata/mockStore.js) and never
// touches the real Supabase project, so there's nothing to mark for
// later bulk-deletion the way the SQL scripts' rows need to be.
//
// Also covers the delegated-permissions feature (user_permissions,
// playbox_orders, meal_regulators — see src/lib/permissions.js): the test
// profile is pre-granted all three permission keys, so there's something to
// see on /playbox and in Klaf.jsx's meal-regulators section right away.
// "משיכת מזון לנסיעות" isn't a permission/table anymore — it's the
// food_pickup_needed checkbox on an event, covered instead by the
// food-pickup-reminder scenario events further down (see getFoodPickupState
// in src/lib/eventConfirmations.js).

function pad(n) {
  return String(n).padStart(2, "0");
}

function dateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeStr(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Today at local midnight, plus `days` whole days.
function dayOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

// "Now" plus/minus some minutes (can be fractional hours via minutes).
function minuteOffset(minutes) {
  return new Date(Date.now() + minutes * 60000);
}

// An ISO timestamp `days` ago (used for created_date/updated_date on gaps,
// so the "stale" filter and date sorting have something real to bite on).
function daysAgoIso(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

const stamp = { created_by: "test-seed", created_by_id: null, created_date: new Date().toISOString(), updated_date: new Date().toISOString() };

export function buildProfile() {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    email: "test-admin@local.test",
    full_name: "מנהל מצב בדיקה",
    role: "admin",
    pluga: null,
    equipment_manager: false,
    notifications_last_read: null,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
  };
}

export function buildFixtures() {
  const D0 = dayOffset(0); // today
  const D1 = dayOffset(1);
  const D2 = dayOffset(2);
  const D3 = dayOffset(3);
  // D+4 deliberately unused — a second, unlabeled empty day (mirrors the
  // SQL seed's gap between D+3 and the deliberately-empty day).
  const D5 = dayOffset(5); // deliberately left with zero rows (empty-state test)
  const D6 = dayOffset(6); // "full day" — everything on it is already completed

  const daily_routines = [
    // D0 (today): fully assigned
    { id: "40000000-0000-4000-8000-000000000001", routine_date: dateStr(D0), morning_assembly_plugas: ["פארן", "בשור"], frisa_morning: "צין", noon_cleaning: "רמון", evening_cleaning: "תמר", ...stamp },
    // D1 (tomorrow): partial — one field assigned (פארן), two "טרם הוחלט", one to בשור
    { id: "40000000-0000-4000-8000-000000000002", routine_date: dateStr(D1), morning_assembly_plugas: ["פארן"], frisa_morning: "טרם הוחלט", noon_cleaning: "טרם הוחלט", evening_cleaning: "בשור", ...stamp },
    // D2: everything unassigned
    { id: "40000000-0000-4000-8000-000000000003", routine_date: dateStr(D2), morning_assembly_plugas: [], frisa_morning: "טרם הוחלט", noon_cleaning: "טרם הוחלט", evening_cleaning: "טרם הוחלט", ...stamp },
    // D6: fully assigned to פארן (completions below)
    { id: "40000000-0000-4000-8000-000000000004", routine_date: dateStr(D6), morning_assembly_plugas: ["פארן"], frisa_morning: "פארן", noon_cleaning: "פארן", evening_cleaning: "פארן", ...stamp },
  ];

  const events = [
    // D0 (today): internal, single pluga
    { id: "10000000-0000-4000-8000-000000000001", event_type: "פנימי", event_date: dateStr(D0), start_time: "09:00", end_time: "10:00", title: "מסדר פנימי - פארן בלבד", details: null, transport_pluga: null, transport_details: null, food_pluga: null, food_details: null, responsible_plugas: ["פארן"], reminder_offset_minutes: null, ...stamp },
    // D0 (today): internal, multiple plugot
    { id: "10000000-0000-4000-8000-000000000002", event_type: "פנימי", event_date: dateStr(D0), start_time: "11:00", end_time: "12:00", title: "פעילות פנימית - כמה פלוגות", details: null, transport_pluga: null, transport_details: null, food_pluga: null, food_details: null, responsible_plugas: ["בשור", "צין"], reminder_offset_minutes: null, ...stamp },
    // D1 (tomorrow): internal, NOT assigned yet — shows in "משימות לשיבוץ"
    { id: "10000000-0000-4000-8000-000000000003", event_type: "פנימי", event_date: dateStr(D1), start_time: "10:00", end_time: "11:00", title: "אירוע פנימי טרם שובץ", details: null, transport_pluga: null, transport_details: null, food_pluga: null, food_details: null, responsible_plugas: [], reminder_offset_minutes: null, ...stamp },
    // D3: external, transport+food assigned to different plugot (overlaps a constraint below)
    { id: "10000000-0000-4000-8000-000000000004", event_type: "חיצוני", event_date: dateStr(D3), start_time: "13:00", end_time: "16:00", title: "טיול שנתי", details: "לבדיקת חפיפה עם אילוץ", transport_pluga: "רמון", transport_details: "הסעה משוריינת - 3 אוטובוסים", food_pluga: "תמר", food_details: "ארוחת צהריים בשטח", responsible_plugas: null, reminder_offset_minutes: null, ...stamp },
    // D3: external, only transport assigned, food "טרם הוחלט"
    { id: "10000000-0000-4000-8000-000000000005", event_type: "חיצוני", event_date: dateStr(D3), start_time: "17:00", end_time: "19:00", title: "אירוע ערב - אוכל טרם שובץ", details: null, transport_pluga: "פארן", transport_details: null, food_pluga: null, food_details: null, responsible_plugas: null, reminder_offset_minutes: null, ...stamp },
    // D6: internal, assigned to פארן (completion below)
    { id: "10000000-0000-4000-8000-000000000006", event_type: "פנימי", event_date: dateStr(D6), start_time: "08:00", end_time: "09:00", title: "יום מושלם - אירוע", details: null, transport_pluga: null, transport_details: null, food_pluga: null, food_details: null, responsible_plugas: ["פארן"], reminder_offset_minutes: null, ...stamp },

    // --- event-confirmation scenarios (was refresh_test_confirmations.sql) ---
    // Scenario 1: already confirmed — 3h out, default 90-min offset. Confirmed
    // state short-circuits, so the exact timing doesn't matter here.
    { id: "90000000-0000-4000-8000-000000000001", event_type: "פנימי", event_date: dateStr(minuteOffset(180)), start_time: timeStr(minuteOffset(180)), end_time: timeStr(minuteOffset(240)), title: "אירוע מאושר - פארן", details: "תרחיש: אישור הגעה כבר בוצע", transport_pluga: null, transport_details: null, food_pluga: null, food_details: null, responsible_plugas: ["פארן"], reminder_offset_minutes: 90, ...stamp },
    // Scenario 2: 5h out, 90-min offset -> threshold in 3.5h -> 'upcoming'
    { id: "90000000-0000-4000-8000-000000000002", event_type: "חיצוני", event_date: dateStr(minuteOffset(300)), start_time: timeStr(minuteOffset(300)), end_time: timeStr(minuteOffset(360)), title: "אירוע עתידי רחוק - בשור", details: "תרחיש: לפני סף התזכורת", transport_pluga: null, transport_details: null, food_pluga: null, food_details: null, responsible_plugas: ["בשור"], reminder_offset_minutes: 90, ...stamp },
    // Scenario 3: 1h out, 90-min offset -> threshold was 30 min ago -> 'reminder'
    { id: "90000000-0000-4000-8000-000000000003", event_type: "פנימי", event_date: dateStr(minuteOffset(60)), start_time: timeStr(minuteOffset(60)), end_time: timeStr(minuteOffset(120)), title: "אירוע דורש תזכורת - צין", details: "תרחיש: אחרי סף התזכורת, לפני תחילת האירוע", transport_pluga: null, transport_details: null, food_pluga: null, food_details: null, responsible_plugas: ["צין"], reminder_offset_minutes: 90, ...stamp },
    // Scenario 4: started 1h ago -> 'escalated'
    { id: "90000000-0000-4000-8000-000000000004", event_type: "חיצוני", event_date: dateStr(minuteOffset(-60)), start_time: timeStr(minuteOffset(-60)), end_time: timeStr(minuteOffset(0)), title: "אירוע שחלף מועדו - רמון", details: "תרחיש: המועד כבר עבר וטרם אושר", transport_pluga: null, transport_details: null, food_pluga: null, food_details: null, responsible_plugas: ["רמון"], reminder_offset_minutes: 90, ...stamp },
    // Scenario 5: 45 min out, 90-min offset -> threshold was 45 min ago ->
    // unconfirmed plugot show 'reminder'. All 5 plugot + 2 contacts.
    { id: "90000000-0000-4000-8000-000000000005", event_type: "חיצוני", event_date: dateStr(minuteOffset(45)), start_time: timeStr(minuteOffset(45)), end_time: timeStr(minuteOffset(225)), title: "אירוע לכל הפלוגות - סטטוסים מעורבים", details: "תרחיש: חלק אישרו, חלק לא, כל הפלוגות", transport_pluga: null, transport_details: null, food_pluga: null, food_details: null, responsible_plugas: ["פארן", "בשור", "צין", "רמון", "תמר"], reminder_offset_minutes: 90, ...stamp },

    // --- food-pickup reminder scenarios (events.food_pickup_needed — see
    // getFoodPickupState() in src/lib/eventConfirmations.js). Mirrors the
    // event-confirmation scenarios above but against the food-pickup
    // thresholds (24h-before reminder, 90-min urgent, then overdue) instead.
    // Scenario F1: ~30h out -> before the 24h-before threshold -> 'upcoming' (no badge yet)
    { id: "95000000-0000-4000-8000-000000000001", event_type: "חיצוני", event_date: dateStr(minuteOffset(1800)), start_time: timeStr(minuteOffset(1800)), end_time: timeStr(minuteOffset(1860)), title: "פעילות חוץ - פארן", details: "תרחיש משיכת אוכל: לפני סף התזכורת", transport_pluga: null, transport_details: null, food_pluga: "פארן", food_details: "כריכים ל-20 אנשים", responsible_plugas: null, reminder_offset_minutes: null, food_pickup_needed: true, ...stamp },
    // Scenario F2: ~20h out -> past the 24h-before threshold, before the 90-min urgent one -> 'reminder'
    { id: "95000000-0000-4000-8000-000000000002", event_type: "חיצוני", event_date: dateStr(minuteOffset(1200)), start_time: timeStr(minuteOffset(1200)), end_time: timeStr(minuteOffset(1260)), title: "פעילות חוץ - בשור", details: "תרחיש משיכת אוכל: יום לפני האירוע", transport_pluga: null, transport_details: null, food_pluga: "בשור", food_details: "כריכים ל-15 אנשים", responsible_plugas: null, reminder_offset_minutes: null, food_pickup_needed: true, ...stamp },
    // Scenario F3: 45 min out -> inside the 90-min urgent window -> 'urgent'
    { id: "95000000-0000-4000-8000-000000000003", event_type: "חיצוני", event_date: dateStr(minuteOffset(45)), start_time: timeStr(minuteOffset(45)), end_time: timeStr(minuteOffset(105)), title: "פעילות חוץ - צין", details: "תרחיש משיכת אוכל: קרוב מאוד", transport_pluga: null, transport_details: null, food_pluga: "צין", food_details: "ארוחת צהריים בשטח", responsible_plugas: null, reminder_offset_minutes: null, food_pickup_needed: true, ...stamp },
    // Scenario F4: started 30 min ago -> past the event's start time -> 'overdue'
    { id: "95000000-0000-4000-8000-000000000004", event_type: "חיצוני", event_date: dateStr(minuteOffset(-30)), start_time: timeStr(minuteOffset(-30)), end_time: timeStr(minuteOffset(30)), title: "פעילות חוץ - רמון", details: "תרחיש משיכת אוכל: המועד עבר", transport_pluga: null, transport_details: null, food_pluga: "רמון", food_details: "ארוחת בוקר בשטח", responsible_plugas: null, reminder_offset_minutes: null, food_pickup_needed: true, ...stamp },
  ];

  const constraints = [
    // D3: overlaps E4 (transport, רמון) — tests side-by-side layout. `plugas` array (admin-style save).
    { id: "30000000-0000-4000-8000-000000000001", pluga: null, plugas: ["רמון"], constraint_date: dateStr(D3), start_time: "13:30", end_time: "14:30", title: "אילוץ חופף - רמון", details: "בודק תצוגה זה-לצד-זה עם האירוע", ...stamp },
    // D3: crosses midnight — exercises cross-midnight height calc. Singular `pluga` (klaf-style save).
    { id: "30000000-0000-4000-8000-000000000002", pluga: "פארן", plugas: null, constraint_date: dateStr(D3), start_time: "22:00", end_time: "02:00", title: "אילוץ חוצה חצות - פארן", details: null, ...stamp },
    // D0 (today): normal, two plugot via `plugas` array
    { id: "30000000-0000-4000-8000-000000000003", pluga: null, plugas: ["פארן", "בשור"], constraint_date: dateStr(D0), start_time: "08:00", end_time: "09:30", title: "אילוץ רגיל - שתי פלוגות", details: null, ...stamp },
  ];

  const direct_tasks = [
    // D0 (today): single pluga, has a time (shows on the לוז timeline too)
    { id: "20000000-0000-4000-8000-000000000001", title: "משימה ישירה עם שעה", pluga: "צין", responsible_plugas: null, task_date: dateStr(D0), start_time: "14:00", end_time: "15:00", status: "פתוחה", notes: null, ...stamp },
    // D0 (today): multiple plugot, no time
    { id: "20000000-0000-4000-8000-000000000002", title: "משימה למספר פלוגות", pluga: null, responsible_plugas: ["רמון", "תמר"], task_date: dateStr(D0), start_time: null, end_time: null, status: "פתוחה", notes: null, ...stamp },
    // D0 (today): assigned to ALL 5 plugot — tests the chip row doesn't overflow
    { id: "20000000-0000-4000-8000-000000000005", title: "משימה לכל הפלוגות", pluga: null, responsible_plugas: ["פארן", "בשור", "צין", "רמון", "תמר"], task_date: dateStr(D0), start_time: null, end_time: null, status: "פתוחה", notes: null, ...stamp },
    // D1 (tomorrow): very long title + notes — tests wrapping/truncation
    { id: "20000000-0000-4000-8000-000000000004", title: "משימה עם כותרת ארוכה מאוד כדי לבדוק שהעיצוב לא נשבר ושהטקסט מתגלגל יפה בכרטיסייה ולא גולש מחוץ לגבולות המסגרת בשום מסך", pluga: "בשור", responsible_plugas: null, task_date: dateStr(D1), start_time: null, end_time: null, status: "פתוחה", notes: "הערה ארוכה גם כן, כדי לוודא שגם טקסט חופשי ארוך במיוחד מוצג כראוי ולא שובר את הפריסה של הכרטיסייה.", ...stamp },
    // Backlog (no date): no pluga yet
    { id: "20000000-0000-4000-8000-000000000006", title: "משימה כללית לשיבוץ - ללא פלוגה", pluga: null, responsible_plugas: null, task_date: null, start_time: null, end_time: null, status: "פתוחה", notes: null, ...stamp },
    // Backlog (no date): single pluga pre-set
    { id: "20000000-0000-4000-8000-000000000007", title: "משימה כללית לשיבוץ - עם פלוגה", pluga: "צין", responsible_plugas: null, task_date: null, start_time: null, end_time: null, status: "פתוחה", notes: null, ...stamp },
    // Backlog (no date): multiple plugot pre-set
    { id: "20000000-0000-4000-8000-000000000008", title: "משימה כללית - מספר פלוגות", pluga: null, responsible_plugas: ["פארן", "רמון"], task_date: null, start_time: null, end_time: null, status: "פתוחה", notes: null, ...stamp },
    // D6: two tasks, both already done
    { id: "20000000-0000-4000-8000-000000000009", title: "יום מושלם - משימה 1", pluga: "פארן", responsible_plugas: null, task_date: dateStr(D6), start_time: null, end_time: null, status: "טופלה", notes: null, ...stamp },
    { id: "20000000-0000-4000-8000-000000000010", title: "יום מושלם - משימה 2", pluga: "פארן", responsible_plugas: null, task_date: dateStr(D6), start_time: null, end_time: null, status: "טופלה", notes: null, ...stamp },
  ];

  const task_completions = [
    // D1 (tomorrow): the one assigned shotaf field is completed, everything else that day stays open — a mixed day
    { id: "70000000-0000-4000-8000-000000000001", task_type: "shotaf", task_id: "40000000-0000-4000-8000-000000000002", task_field: "morning_assembly_plugas", task_label: "מסדר בוקר", task_date: dateStr(D1), pluga: "פארן", ...stamp },
    // D6: all 4 shotaf fields for פארן
    { id: "70000000-0000-4000-8000-000000000002", task_type: "shotaf", task_id: "40000000-0000-4000-8000-000000000004", task_field: "frisa_morning", task_label: "משיכת פינת פריסה", task_date: dateStr(D6), pluga: "פארן", ...stamp },
    { id: "70000000-0000-4000-8000-000000000003", task_type: "shotaf", task_id: "40000000-0000-4000-8000-000000000004", task_field: "morning_assembly_plugas", task_label: "מסדר בוקר", task_date: dateStr(D6), pluga: "פארן", ...stamp },
    { id: "70000000-0000-4000-8000-000000000004", task_type: "shotaf", task_id: "40000000-0000-4000-8000-000000000004", task_field: "noon_cleaning", task_label: "ניקוי צהריים", task_date: dateStr(D6), pluga: "פארן", ...stamp },
    { id: "70000000-0000-4000-8000-000000000005", task_type: "shotaf", task_id: "40000000-0000-4000-8000-000000000004", task_field: "evening_cleaning", task_label: "ניקוי ערב", task_date: dateStr(D6), pluga: "פארן", ...stamp },
    // D6: the internal event
    { id: "70000000-0000-4000-8000-000000000006", task_type: "event", task_id: "10000000-0000-4000-8000-000000000006", task_field: "responsible", task_label: "יום מושלם - אירוע", task_date: dateStr(D6), pluga: "פארן", ...stamp },
    // D6: the two direct tasks
    { id: "70000000-0000-4000-8000-000000000007", task_type: "direct", task_id: "20000000-0000-4000-8000-000000000009", task_field: "20000000-0000-4000-8000-000000000009", task_label: "יום מושלם - משימה 1", task_date: dateStr(D6), pluga: "פארן", ...stamp },
    { id: "70000000-0000-4000-8000-000000000008", task_type: "direct", task_id: "20000000-0000-4000-8000-000000000010", task_field: "20000000-0000-4000-8000-000000000010", task_label: "יום מושלם - משימה 2", task_date: dateStr(D6), pluga: "פארן", ...stamp },
  ];

  const event_contacts = [
    // Only on the all-plugot confirmation event (scenario 5), per plan.
    { id: "91000000-0000-4000-8000-000000000001", event_id: "90000000-0000-4000-8000-000000000005", name: "נהג אוטובוס", phone: "0500000001", role_label: "נהג", ...stamp },
    { id: "91000000-0000-4000-8000-000000000002", event_id: "90000000-0000-4000-8000-000000000005", name: "רכז אירוע", phone: "0500000002", role_label: "רכז", ...stamp },
  ];

  const nowIso = new Date().toISOString();
  const event_confirmations = [
    { id: "92000000-0000-4000-8000-000000000001", event_id: "90000000-0000-4000-8000-000000000001", pluga: "פארן", confirmed: true, confirmed_by: "test-seed", confirmed_by_id: null, confirmed_at: nowIso, ...stamp },
    { id: "92000000-0000-4000-8000-000000000002", event_id: "90000000-0000-4000-8000-000000000002", pluga: "בשור", confirmed: false, confirmed_by: null, confirmed_by_id: null, confirmed_at: null, ...stamp },
    { id: "92000000-0000-4000-8000-000000000003", event_id: "90000000-0000-4000-8000-000000000003", pluga: "צין", confirmed: false, confirmed_by: null, confirmed_by_id: null, confirmed_at: null, ...stamp },
    { id: "92000000-0000-4000-8000-000000000004", event_id: "90000000-0000-4000-8000-000000000004", pluga: "רמון", confirmed: false, confirmed_by: null, confirmed_by_id: null, confirmed_at: null, ...stamp },
    { id: "92000000-0000-4000-8000-000000000005", event_id: "90000000-0000-4000-8000-000000000005", pluga: "פארן", confirmed: true, confirmed_by: "test-seed", confirmed_by_id: null, confirmed_at: nowIso, ...stamp },
    { id: "92000000-0000-4000-8000-000000000006", event_id: "90000000-0000-4000-8000-000000000005", pluga: "בשור", confirmed: true, confirmed_by: "test-seed", confirmed_by_id: null, confirmed_at: nowIso, ...stamp },
    { id: "92000000-0000-4000-8000-000000000007", event_id: "90000000-0000-4000-8000-000000000005", pluga: "צין", confirmed: false, confirmed_by: null, confirmed_by_id: null, confirmed_at: null, ...stamp },
    { id: "92000000-0000-4000-8000-000000000008", event_id: "90000000-0000-4000-8000-000000000005", pluga: "רמון", confirmed: false, confirmed_by: null, confirmed_by_id: null, confirmed_at: null, ...stamp },
    { id: "92000000-0000-4000-8000-000000000009", event_id: "90000000-0000-4000-8000-000000000005", pluga: "תמר", confirmed: false, confirmed_by: null, confirmed_by_id: null, confirmed_at: null, ...stamp },
  ];

  // ---------------------------------------------------------------------
  // gaps (פערים) — company === pluga. Covers every status/priority
  // combination, a couple of stale ones (old updated_date, for the "ישן"
  // filter), and both fully-filled and mostly-empty optional fields.
  // ---------------------------------------------------------------------
  const gaps = [
    { id: "50000000-0000-4000-8000-000000000001", company: "פארן", gap: "תאורה לא תקינה בכניסה למגורי בנים", location: "כניסה למגורי בנים", class_name: null, building_number: "12", room_number: null, status: "טרם הועלה", priority: "קריטי", note: "שני גופי תאורה כבויים, מסוכן בלילה", reporter_name: "רב\"ט כהן", reporter_phone: "0521234567", attachments: [], created_by: "test-seed", created_by_id: null, created_date: daysAgoIso(0.1), updated_date: daysAgoIso(0.1) },
    { id: "50000000-0000-4000-8000-000000000002", company: "בשור", gap: "ברז שבור בפינת פריסה", location: "פינת פריסה", class_name: null, building_number: null, room_number: null, status: "בטיפול", priority: "גבוה", note: "הוזמן איש מקצוע, ממתין לתיאום", reporter_name: "סמל לוי", reporter_phone: "0529876543", attachments: [], created_by: "test-seed", created_by_id: null, created_date: daysAgoIso(3), updated_date: daysAgoIso(1) },
    { id: "50000000-0000-4000-8000-000000000003", company: "צין", gap: "כיסאות שבורים בספרייה", location: "שולחנות ספרייה", class_name: null, building_number: null, room_number: null, status: "בטיפול", priority: "בינוני", note: "3 כיסאות דורשים החלפה", reporter_name: null, reporter_phone: null, attachments: [], created_by: "test-seed", created_by_id: null, created_date: daysAgoIso(14), updated_date: daysAgoIso(11) },
    { id: "50000000-0000-4000-8000-000000000004", company: "רמון", gap: "חוסר בפחי אשפה", location: "פינת עישון", class_name: null, building_number: null, room_number: null, status: "טרם הועלה", priority: "נמוך", note: null, reporter_name: "טוראי מזרחי", reporter_phone: "0541112233", attachments: [], created_by: "test-seed", created_by_id: null, created_date: daysAgoIso(0.3), updated_date: daysAgoIso(0.3) },
    { id: "50000000-0000-4000-8000-000000000005", company: "תמר", gap: "מזגן לא עובד בכיתה", location: "כיתות", class_name: "כיתה 4", building_number: "7", room_number: "104", status: "טופל", priority: "גבוה", note: "טופל ע\"י טכנאי מיזוג, נבדק ועובד", reporter_name: "רס\"ר תמר", reporter_phone: "0538765432", attachments: [], created_by: "test-seed", created_by_id: null, created_date: daysAgoIso(20), updated_date: daysAgoIso(15) },
    { id: "50000000-0000-4000-8000-000000000006", company: "פארן", gap: "תאורת חירום כבויה במתחם קמנים", location: "מתחם קמנים", class_name: null, building_number: "3", room_number: null, status: "בטיפול", priority: "קריטי", note: "דווח כבר לפני 3 שבועות, עדיין לא טופל", reporter_name: "סגן רוזן", reporter_phone: "0505554433", attachments: [], created_by: "test-seed", created_by_id: null, created_date: daysAgoIso(25), updated_date: daysAgoIso(22) },
    { id: "50000000-0000-4000-8000-000000000007", company: "בשור", gap: "שביל בוץ אחרי גשם", location: "שביל", class_name: null, building_number: null, room_number: null, status: "טופל", priority: "בינוני", note: "נסלל שביל אבן", reporter_name: null, reporter_phone: null, attachments: [], created_by: "test-seed", created_by_id: null, created_date: daysAgoIso(30), updated_date: daysAgoIso(28) },
    { id: "50000000-0000-4000-8000-000000000008", company: "צין", gap: "דשא לא מטופל בכניסה למתחם", location: "דשא כניסה למתחם", class_name: null, building_number: null, room_number: null, status: "בטיפול", priority: "נמוך", note: null, reporter_name: null, reporter_phone: null, attachments: [], created_by: "test-seed", created_by_id: null, created_date: daysAgoIso(2), updated_date: daysAgoIso(2) },
  ];

  const gap_updates = [
    // Gap #2 (בשור, ברז שבור): status change history + a free-text comment
    { id: "51000000-0000-4000-8000-000000000001", gap_id: "50000000-0000-4000-8000-000000000002", update_type: "שינוי סטטוס", field: "סטטוס", old_value: "טרם הועלה", new_value: "בטיפול", text: "הסטטוס שונה מ-טרם הועלה ל-בטיפול", author_name: "מנהל מצב בדיקה", created_by: "test-seed", created_by_id: null, created_date: daysAgoIso(2), updated_date: daysAgoIso(2) },
    { id: "51000000-0000-4000-8000-000000000002", gap_id: "50000000-0000-4000-8000-000000000002", update_type: "תגובה", field: null, old_value: null, new_value: null, text: "דיברתי עם האינסטלטור, מגיע ביום שלישי הקרוב", author_name: "מנהל מצב בדיקה", created_by: "test-seed", created_by_id: null, created_date: daysAgoIso(1), updated_date: daysAgoIso(1) },
    // Gap #5 (תמר, מזגן, archived): full history to status טופל
    { id: "51000000-0000-4000-8000-000000000003", gap_id: "50000000-0000-4000-8000-000000000005", update_type: "שינוי סטטוס", field: "סטטוס", old_value: "טרם הועלה", new_value: "בטיפול", text: "הסטטוס שונה מ-טרם הועלה ל-בטיפול", author_name: "מנהל מצב בדיקה", created_by: "test-seed", created_by_id: null, created_date: daysAgoIso(18), updated_date: daysAgoIso(18) },
    { id: "51000000-0000-4000-8000-000000000004", gap_id: "50000000-0000-4000-8000-000000000005", update_type: "שינוי סטטוס", field: "סטטוס", old_value: "בטיפול", new_value: "טופל", text: "הסטטוס שונה מ-בטיפול ל-טופל", author_name: "מנהל מצב בדיקה", created_by: "test-seed", created_by_id: null, created_date: daysAgoIso(15), updated_date: daysAgoIso(15) },
  ];

  // ---------------------------------------------------------------------
  // Equipment (משיכות ציוד) — warehouse_items per warehouse, a few items
  // currently checked out (equipment_holdings, one overdue), and a mix of
  // pending/approved/rejected withdrawal requests.
  // ---------------------------------------------------------------------
  const warehouse_items = [
    { id: "60000000-0000-4000-8000-000000000001", warehouse: "מכולה", name: "כיסאות מתקפלים", quantity: 80, returnable: false, ...stamp },
    { id: "60000000-0000-4000-8000-000000000002", warehouse: "מכולה", name: "שולחנות מתקפלים", quantity: 15, returnable: false, target_quantity: 20, ...stamp },
    // target_quantity: 10 with only 6 on hand demonstrates the
    // withdrawal-time shortage suggestion (see
    // supabase/migrations/0012_warehouse_item_target_quantity.sql) right
    // away — withdrawing even one tent triggers it.
    { id: "60000000-0000-4000-8000-000000000003", warehouse: "מכולה", name: "אוהלים", quantity: 6, returnable: true, target_quantity: 10, ...stamp },
    { id: "60000000-0000-4000-8000-000000000004", warehouse: "מחסן קרביץ", name: "אפודי קרביץ", quantity: 45, returnable: true, ...stamp },
    { id: "60000000-0000-4000-8000-000000000005", warehouse: "מחסן קרביץ", name: "קסדות", quantity: 40, returnable: true, ...stamp },
    { id: "60000000-0000-4000-8000-000000000006", warehouse: "מחסן קרביץ", name: "רתמות", quantity: 25, returnable: true, ...stamp },
    { id: "60000000-0000-4000-8000-000000000007", warehouse: "מחסן לוגיסטי", name: "גנרטור", quantity: 3, returnable: true, ...stamp },
    { id: "60000000-0000-4000-8000-000000000008", warehouse: "מחסן לוגיסטי", name: "פנסי ראש", quantity: 35, returnable: false, ...stamp },
    { id: "60000000-0000-4000-8000-000000000009", warehouse: "מחסן לוגיסטי", name: "חבלים", quantity: 20, returnable: false, ...stamp },
  ];

  const equipment_holdings = [
    // Normal, within its expected return window
    { id: "61000000-0000-4000-8000-000000000001", item_name: "אוהלים", warehouse: "מכולה", quantity: 2, pluga: "פארן", held_by_name: 'רס"ר פארן', withdrawal_date: dateStr(dayOffset(-1)), expected_return_date: dateStr(D3), ...stamp },
    // Overdue — expected_return_date already passed, still checked out
    { id: "61000000-0000-4000-8000-000000000002", item_name: "אפודי קרביץ", warehouse: "מחסן קרביץ", quantity: 10, pluga: "בשור", held_by_name: 'סמל בשור', withdrawal_date: dateStr(dayOffset(-10)), expected_return_date: dateStr(dayOffset(-3)), ...stamp },
    // Open-ended — no expected return date at all
    { id: "61000000-0000-4000-8000-000000000003", item_name: "גנרטור", warehouse: "מחסן לוגיסטי", quantity: 1, pluga: "רמון", held_by_name: 'קצין רמון', withdrawal_date: dateStr(dayOffset(-2)), expected_return_date: null, ...stamp },
  ];

  const equipment_settings = [
    { id: "62000000-0000-4000-8000-000000000001", responsible_klaf_id: null, responsible_klaf_name: null, notification_emails: [], ...stamp },
  ];

  const withdrawal_requests = [
    // pending
    { id: "63000000-0000-4000-8000-000000000001", warehouse: "מחסן קרביץ", items: [{ name: "קסדות", quantity: 15, returnable: true }], requested_by_name: "טוראי תמר", pluga: "תמר", request_date: dateStr(D0), expected_return_date: dateStr(D3), notes: "לאימון סוף שבוע", status: "pending", approved_by_name: null, ...stamp },
    { id: "63000000-0000-4000-8000-000000000002", warehouse: "מכולה", items: [{ name: "כיסאות מתקפלים", quantity: 30, returnable: false }], requested_by_name: "טוראי צין", pluga: "צין", request_date: dateStr(D0), expected_return_date: null, notes: null, status: "pending", approved_by_name: null, ...stamp },
    // approved
    { id: "63000000-0000-4000-8000-000000000003", warehouse: "מחסן לוגיסטי", items: [{ name: "פנסי ראש", quantity: 10, returnable: false }], requested_by_name: "סמל פארן", pluga: "פארן", request_date: dateStr(dayOffset(-1)), expected_return_date: null, notes: null, status: "approved", approved_by_name: "מנהל מצב בדיקה", ...stamp },
    // rejected
    { id: "63000000-0000-4000-8000-000000000004", warehouse: "מחסן קרביץ", items: [{ name: "רתמות", quantity: 5, returnable: true }], requested_by_name: "רב\"ט בשור", pluga: "בשור", request_date: dateStr(dayOffset(-2)), expected_return_date: dateStr(D1), notes: "אין מספיק מלאי כרגע", status: "rejected", approved_by_name: "מנהל מצב בדיקה", ...stamp },
  ];

  // ---------------------------------------------------------------------
  // profiles (the "משתמשים" tab in the admin menu) — a handful of fake
  // users across every role/pluga, purely so there's something to click
  // through in test mode: expand "הרשאות מיוחדות" for any of them to see
  // the admin-side granting UI, some pre-populated (see user_permissions
  // below), some empty so you can try granting one yourself. In test mode
  // this is the ONLY source for base44.entities.User.list() — the real
  // auth/profile flow (base44.auth.me()) still always returns the fixed
  // admin profile from buildProfile() above, independent of this list.
  // ---------------------------------------------------------------------
  const profiles = [
    { id: "00000000-0000-4000-8000-000000000000", email: "test-admin@local.test", full_name: "מנהל מצב בדיקה", role: "admin", pluga: null, equipment_manager: false, notifications_last_read: null, ...stamp },
    { id: "e0000000-0000-4000-8000-000000000001", email: "roi.cohen@local.test", full_name: "רועי כהן", role: "קלפ", pluga: "פארן", equipment_manager: false, notifications_last_read: null, ...stamp },
    { id: "e0000000-0000-4000-8000-000000000002", email: "dana.levi@local.test", full_name: "דנה לוי", role: "קלפ", pluga: "בשור", equipment_manager: false, notifications_last_read: null, ...stamp },
    { id: "e0000000-0000-4000-8000-000000000003", email: "omer.mizrahi@local.test", full_name: "עומר מזרחי", role: "קלפ", pluga: "צין", equipment_manager: true, notifications_last_read: null, ...stamp },
    { id: "e0000000-0000-4000-8000-000000000004", email: "shira.david@local.test", full_name: "שירה דוד", role: "קלפ", pluga: "רמון", equipment_manager: false, notifications_last_read: null, ...stamp },
    { id: "e0000000-0000-4000-8000-000000000005", email: "itai.peretz@local.test", full_name: "איתי פרץ", role: "קלפ", pluga: "תמר", equipment_manager: false, notifications_last_read: null, ...stamp },
    { id: "e0000000-0000-4000-8000-000000000006", email: "noa.avraham@local.test", full_name: "נועה אברהם", role: "רסר", pluga: null, equipment_manager: false, notifications_last_read: null, ...stamp },
    { id: "e0000000-0000-4000-8000-000000000007", email: "yuval.shimon@local.test", full_name: "יובל שמעון", role: "סגל", pluga: null, equipment_manager: false, notifications_last_read: null, ...stamp },
  ];

  // ---------------------------------------------------------------------
  // Delegated permissions (see src/lib/permissions.js). The test profile
  // (role: admin) holds all three keys, so its own screens (Klaf.jsx's
  // meal-regulators section, /playbox, the frisa task) have something to
  // show right away. A few of the demo users above are ALSO pre-granted
  // permissions, so expanding "הרשאות מיוחדות" for them in "ניהול משתמשים"
  // → משתמשים shows real, already-checked boxes — not just an empty form —
  // including the "one permission, several plugot" case (דנה לוי holds
  // frisa_pina for two plugot at once, exactly the scenario that shaped
  // this schema). Other demo users are left with none, to try granting
  // from a clean state.
  // ---------------------------------------------------------------------
  const user_permissions = [
    { id: "80000000-0000-4000-8000-000000000001", user_id: "00000000-0000-4000-8000-000000000000", permission: "frisa_pina", pluga: "בשור", ...stamp },
    { id: "80000000-0000-4000-8000-000000000002", user_id: "00000000-0000-4000-8000-000000000000", permission: "frisa_pina", pluga: "צין", ...stamp },
    { id: "80000000-0000-4000-8000-000000000003", user_id: "00000000-0000-4000-8000-000000000000", permission: "playbox_orders", pluga: null, ...stamp },
    { id: "80000000-0000-4000-8000-000000000004", user_id: "00000000-0000-4000-8000-000000000000", permission: "meal_regulators", pluga: "פארן", ...stamp },
    // דנה לוי (קלפ, בשור): פינת פריסה עבור שתי פלוגות — ההדגמה הישירה של
    // "הרשאה אחת, כמה פלוגות" דרך שתי שורות.
    { id: "80000000-0000-4000-8000-000000000007", user_id: "e0000000-0000-4000-8000-000000000002", permission: "frisa_pina", pluga: "בשור", ...stamp },
    { id: "80000000-0000-4000-8000-000000000008", user_id: "e0000000-0000-4000-8000-000000000002", permission: "frisa_pina", pluga: "פארן", ...stamp },
    // איתי פרץ (קלפ, תמר): מווסתים לפלוגה שלו.
    { id: "80000000-0000-4000-8000-000000000009", user_id: "e0000000-0000-4000-8000-000000000005", permission: "meal_regulators", pluga: "תמר", ...stamp },
    // יובל שמעון (סגל): האחראי הכלל-ארגוני על הזמנות פלייבוקס.
    { id: "80000000-0000-4000-8000-000000000010", user_id: "e0000000-0000-4000-8000-000000000007", permission: "playbox_orders", pluga: null, ...stamp },
  ];

  // pluga is null on every order below (see
  // supabase/migrations/0013_playbox_orders_optional_pluga.sql) — Playbox
  // doesn't split its catalog by pluga, so no order is ever tagged to one,
  // manual or auto-generated. (The old per-pluga "מלאי ומעקב חוסרים" stock
  // tracker that used to be the one thing still setting a pluga here —
  // playbox_items — was removed for the same reason: this equipment isn't
  // any one pluga's own supply either. See the comment on Playbox() in
  // src/pages/Playbox.jsx.)
  const playbox_orders = [
    { id: "81000000-0000-4000-8000-000000000001", pluga: null, order_date: dateStr(D1), item: "חטיפים", quantity: 10, notes: null, status: "ממתין", auto_generated: false, destination_warehouse: null, ...stamp },
    { id: "81000000-0000-4000-8000-000000000002", pluga: null, order_date: dateStr(D2), item: "שתייה קלה", quantity: 24, notes: "לאירוע יום שלישי", status: "הוזמן", auto_generated: false, destination_warehouse: null, ...stamp },
    { id: "81000000-0000-4000-8000-000000000003", pluga: null, order_date: dateStr(D0), item: "עוגות", quantity: 3, notes: null, status: "בוטל", auto_generated: false, destination_warehouse: null, ...stamp },
    // חוסר במחסן שכבר קיבל הזמנה אוטומטית ממתינה — מדגים את מניעת הכפילות
    // ב-Equipment.jsx's "צור הזמנות בפלייבוקס לכל החוסרים": "שולחנות
    // מתקפלים" (ר' warehouse_items למעלה: 15 מתוך 20 יעד) כבר מכוסה על ידי
    // ההזמנה הזו, כך שהכפתור ידלג עליו; "אוהלים" (6 מתוך 10) נשאר בלי הזמנה
    // ממתינה, כך שהכפתור כן יפעל עליו.
    { id: "81000000-0000-4000-8000-000000000004", pluga: null, order_date: dateStr(D0), item: "שולחנות מתקפלים", quantity: 5, notes: "נוצר אוטומטית ממעקב חוסרי מחסן", status: "ממתין", auto_generated: true, destination_warehouse: null, ...stamp },
    // הזמנה שכבר התקבלה ונכנסה למחסן בפועל — מדגים את destination_warehouse.
    { id: "81000000-0000-4000-8000-000000000005", pluga: null, order_date: dateStr(D2), item: "שקיות זבל", quantity: 20, notes: null, status: "התקבל", auto_generated: false, destination_warehouse: "מחסן קרביץ", ...stamp },
  ];

  const meal_regulators = [
    // entry_time (supabase/migrations/0014_meal_regulator_entry_time.sql) —
    // lunch has פארן entering at 12:15; dinner has no time set yet, to also
    // demo the "not set" state.
    { id: "82000000-0000-4000-8000-000000000001", pluga: "פארן", meal_date: dateStr(D0), meal_type: "צהריים", regulators: [{ name: "רב\"ט כהן", phone: "0521234567" }, { name: "טוראי לוי", phone: null }], entry_time: "12:15", ...stamp },
    { id: "82000000-0000-4000-8000-000000000002", pluga: "פארן", meal_date: dateStr(D0), meal_type: "ערב", regulators: [{ name: "סמל מזרחי", phone: "0529876543" }, { name: "טוראי אבו", phone: null }, { name: "רב\"ט דוד", phone: "0541112233" }], entry_time: null, ...stamp },
  ];

  return {
    daily_routines,
    events,
    constraints,
    direct_tasks,
    task_completions,
    event_contacts,
    event_confirmations,
    gaps,
    gap_updates,
    warehouse_items,
    equipment_holdings,
    equipment_settings,
    withdrawal_requests,
    profiles,
    user_permissions,
    playbox_orders,
    meal_regulators,
  };
}
