// Shared Playbox-order helpers — used by src/pages/Playbox.jsx and by the two
// places that auto-create completion orders from warehouse shortages
// (src/pages/Equipment.jsx and src/components/equipment/WithdrawalForm.jsx),
// so the order shape and its text/Excel formats live in one place.
//
// An order is one playbox_orders row holding several items:
//   items: [{ name, quantity, note }]   (note = unit / remark, e.g. "מטר")
// see supabase/migrations/0019_playbox_multi_item_orders_and_permission_guards.sql.
// Rows from before that migration only had the single-item columns
// (item / quantity), which orderItems() still reads as a one-item list.
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import { toDateStr } from "@/lib/constants";

export const PLAYBOX_STATUSES = ["ממתין", "הוזמן", "התקבל", "בוטל"];

export function orderItems(order) {
  if (Array.isArray(order?.items) && order.items.length > 0) return order.items;
  if (order?.item) return [{ name: order.item, quantity: order.quantity ?? 1, note: null }];
  return [];
}

function itemLine(i) {
  return `${i.name} × ${i.quantity}${i.note ? ` (${i.note})` : ""}`;
}

export function formatOrderAsText(order) {
  const header = `${order.name || "הזמנה"} — ${order.order_date || ""}`;
  const lines = orderItems(order).map((i) => `• ${itemLine(i)}`);
  return [header, ...lines, ...(order.notes ? [`הערות: ${order.notes}`] : [])].join("\n");
}

export function formatOrdersAsText(orders) {
  return `הזמנות פלייבוקס ממתינות (${orders.length}):\n\n${orders.map(formatOrderAsText).join("\n\n")}`;
}

// One order → an .xlsx with one row per item: שם פריט / כמות / מידה/הערה.
export function exportOrderToExcel(order) {
  const rows = orderItems(order).map((i) => ({
    "שם פריט": i.name || "",
    "כמות": Number(i.quantity) || 0,
    "מידה/הערה": i.note || "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows, { header: ["שם פריט", "כמות", "מידה/הערה"] });
  ws["!cols"] = [{ wch: 32 }, { wch: 10 }, { wch: 24 }];
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, "פריטים");
  const safeName = (order.name || "הזמנה").replace(/[\\/:*?"<>|]/g, "_");
  XLSX.writeFile(wb, `הזמנת_פלייבוקס_${safeName}_${order.order_date || ""}.xlsx`);
}

// Creates ONE auto-generated order for every shortage not already covered by
// a pending/ordered auto order (dedup by item name — the warehouses are a
// shared supply, so an open auto order for the item from anywhere covers it).
// `shortages` = [{ name, quantity }]. Returns the created order, or null if
// everything was already covered.
export async function createShortageOrder(shortages, notes) {
  const items = (await uncoveredShortages(shortages))
    .map((s) => ({ name: s.name, quantity: Number(s.quantity), note: null }));
  if (items.length === 0) return null;
  const today = toDateStr(new Date());
  return base44.entities.PlayboxOrder.create({
    name: `השלמת מלאי ${today}`,
    order_date: today,
    items,
    notes,
    status: "ממתין",
    auto_generated: true,
  });
}

// Which of `shortages` are NOT yet covered by an open auto order — also used
// on its own to show a confirm list before createShortageOrder runs.
export async function uncoveredShortages(shortages) {
  const existing = await base44.entities.PlayboxOrder.list("-order_date", 500);
  const covered = new Set(
    existing
      .filter((o) => o.auto_generated && (o.status === "ממתין" || o.status === "הוזמן"))
      .flatMap((o) => orderItems(o).map((i) => i.name))
  );
  return shortages.filter((s) => !covered.has(s.name));
}
