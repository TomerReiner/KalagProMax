// Event logistics checklist — `events.checklist` (jsonb, migration 0021):
//   [{ id, text, pluga|null, done, done_by|null, done_at|null }]
// Edited in EventForm (with ready-made templates per event kind), ticked off
// from the event view on the constraints calendar, and each pluga's own
// items show up inside its קל"פ's "המשימות שלי".

export const CHECKLIST_TEMPLATES = [
  {
    key: "ceremony",
    label: "טקס",
    items: ["במה / פודיום", "מערכת הגברה ומיקרופונים", "כיסאות לקהל", "דגלים וסמלים", "כיבוד", "צלם", "תדריך מנחה והזמנת אורחים"],
  },
  {
    key: "field",
    label: "יציאה לשטח / סיור",
    items: ["אוטובוסים ואישור תנועה", "מנות / ארוחות לשטח", "מים — ג'ריקנים", "ערכת עזרה ראשונה וחובש", "רשימת נוכחות", "קשר עם הנהג", "ציוד שטח (אוהלים, פנסים)"],
  },
  {
    key: "lecture",
    label: "הרצאת אורח",
    items: ["כיתה / אולם", "מקרן ומחשב", "אישור כניסה לבסיס למרצה", "כיבוד למרצה", "מתנה / תעודת הוקרה"],
  },
  {
    key: "pluga",
    label: "אירוע פלוגתי",
    items: ["שריון מקום", "שולחנות וכיסאות", "כיבוד ושתייה", "ציוד הגברה", "ניקיון אחרי האירוע"],
  },
];

export function newChecklistItem(text, pluga = null) {
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    text: text.trim(),
    pluga: pluga || null,
    done: false,
    done_by: null,
    done_at: null,
  };
}

// Appends a template's items, skipping any text already on the list.
export function withTemplate(items, templateKey, defaultPluga = null) {
  const template = CHECKLIST_TEMPLATES.find((t) => t.key === templateKey);
  if (!template) return items;
  const existing = new Set(items.map((i) => i.text));
  return [...items, ...template.items.filter((t) => !existing.has(t)).map((t) => newChecklistItem(t, defaultPluga))];
}

export function toggleItem(items, id, byName) {
  return items.map((i) =>
    i.id === id
      ? { ...i, done: !i.done, done_by: !i.done ? byName || null : null, done_at: !i.done ? new Date().toISOString() : null }
      : i
  );
}

export function checklistProgress(items) {
  const list = Array.isArray(items) ? items : [];
  return { done: list.filter((i) => i.done).length, total: list.length };
}
