import { getSupabaseAdmin, getCallerProfile } from './_lib/supabaseAdmin.js';

// Any signed-in user can request a withdrawal. Mirrors
// base44/functions/processWithdrawal/entry.ts.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = getSupabaseAdmin();
    const caller = await getCallerProfile(req, supabase);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });

    const { warehouse, items, pluga, expected_return_date, notes } = req.body || {};
    if (!warehouse || !items || !items.length || !pluga) {
      return res.status(400).json({ error: 'חסרים פרטים (מחסן, פריטים, פלוגה)' });
    }

    const today = new Date().toISOString().split('T')[0];
    const { data: withdrawal, error } = await supabase
      .from('withdrawal_requests')
      .insert({
        warehouse,
        items: items.map((i) => ({ name: i.name, quantity: i.quantity, returnable: i.returnable })),
        requested_by_name: caller.profile?.full_name || caller.user.email,
        pluga,
        request_date: today,
        expected_return_date: expected_return_date || null,
        notes: notes || null,
        status: 'pending',
        created_by: caller.user.email,
        created_by_id: caller.user.id,
      })
      .select()
      .single();
    if (error) throw error;

    // TODO: email EquipmentSettings.notification_emails once an email
    // provider is configured — see submit-access-request.js's TODO.

    return res.status(200).json({ success: true, withdrawal });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
