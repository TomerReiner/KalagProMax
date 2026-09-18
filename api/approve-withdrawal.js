import { getSupabaseAdmin, getCallerProfile } from './_lib/supabaseAdmin.js';

// Admin or equipment_manager only. Mirrors
// base44/functions/approveWithdrawal/entry.ts.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = getSupabaseAdmin();
    const caller = await getCallerProfile(req, supabase);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });
    if (caller.profile?.role !== 'admin' && !caller.profile?.equipment_manager) {
      return res.status(403).json({ error: 'אין הרשאה לאשר בקשות' });
    }

    const { withdrawal_id, decision } = req.body || {};
    if (!withdrawal_id || !decision) return res.status(400).json({ error: 'חסרים פרטים' });
    if (decision !== 'approved' && decision !== 'rejected') {
      return res.status(400).json({ error: 'החלטה לא תקינה' });
    }

    const { data: withdrawal, error: getErr } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', withdrawal_id)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!withdrawal) return res.status(404).json({ error: 'בקשה לא נמצאה' });
    if (withdrawal.status !== 'pending') return res.status(400).json({ error: 'הבקשה כבר טופלה' });

    const approverName = caller.profile?.full_name || caller.user.email;

    if (decision === 'rejected') {
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({ status: 'rejected', approved_by_name: approverName })
        .eq('id', withdrawal_id);
      if (error) throw error;
      return res.status(200).json({ success: true, status: 'rejected' });
    }

    // Approved — process the withdrawal
    const { warehouse, items, pluga, expected_return_date } = withdrawal;
    const today = new Date().toISOString().split('T')[0];

    const { data: warehouseItems, error: wiErr } = await supabase
      .from('warehouse_items')
      .select('*')
      .eq('warehouse', warehouse);
    if (wiErr) throw wiErr;

    for (const item of items) {
      const wi = warehouseItems.find((w) => w.name === item.name);
      if (!wi) return res.status(400).json({ error: `פריט "${item.name}" לא נמצא במחסן` });
      if (wi.quantity < item.quantity) {
        return res.status(400).json({
          error: `אין מספיק "${item.name}" במלאי (יש ${wi.quantity}, מבוקש ${item.quantity})`,
        });
      }
    }

    for (const item of items) {
      const wi = warehouseItems.find((w) => w.name === item.name);
      const { error } = await supabase
        .from('warehouse_items')
        .update({ quantity: wi.quantity - item.quantity })
        .eq('id', wi.id);
      if (error) throw error;
    }

    const returnableItems = items.filter((i) => i.returnable);
    if (returnableItems.length > 0) {
      const { error } = await supabase.from('equipment_holdings').insert(
        returnableItems.map((i) => ({
          item_name: i.name,
          warehouse,
          quantity: i.quantity,
          pluga,
          held_by_name: withdrawal.requested_by_name,
          withdrawal_date: today,
          expected_return_date: expected_return_date || null,
        }))
      );
      if (error) throw error;
    }

    const { error: updErr } = await supabase
      .from('withdrawal_requests')
      .update({ status: 'approved', approved_by_name: approverName })
      .eq('id', withdrawal_id);
    if (updErr) throw updErr;

    return res.status(200).json({ success: true, status: 'approved' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
