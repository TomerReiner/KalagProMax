// Phone helpers for "ספר קשר" and anywhere a person's phone is shown.
// Israeli numbers are typically stored as 05XXXXXXXX; WhatsApp needs the
// international form without "+" (9725XXXXXXXX).
export function cleanPhone(phone) {
  return String(phone || "").replace(/[^0-9+]/g, "");
}

export function telHref(phone) {
  const p = cleanPhone(phone);
  return p ? `tel:${p}` : null;
}

export function whatsappHref(phone, text) {
  let p = cleanPhone(phone).replace(/^\+/, "");
  if (!p) return null;
  if (p.startsWith("0")) p = `972${p.slice(1)}`;
  return `https://wa.me/${p}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function formatPhone(phone) {
  const p = cleanPhone(phone);
  if (/^05\d{8}$/.test(p)) return `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`;
  return p;
}

export const ROLE_LABELS = {
  admin: "מנהל מערכת",
  קלפ: 'קל"פ',
  רסר: 'רס"ר',
  סגל: "סגל",
};
