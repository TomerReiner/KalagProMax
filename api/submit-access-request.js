import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

// Public endpoint — anyone can ask for access, admins approve/deny in the
// AdminPanel. Mirrors base44/functions/submitAccessRequest/entry.ts.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = getSupabaseAdmin();
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    const full_name = (req.body?.full_name || '').toString().trim();

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'נדרש אימייל תקין' });
    }

    const { data: existing, error: existingErr } = await supabase
      .from('access_requests')
      .select('id, status')
      .eq('email', email);
    if (existingErr) throw existingErr;

    if (existing && existing.length > 0) {
      const pending = existing.find((r) => r.status === 'pending');
      if (pending) return res.status(409).json({ error: 'הבקשה כבר נשלחה וממתינה לאישור' });
      return res.status(409).json({ error: 'כבר הוגשה בקשה עם אימייל זה' });
    }

    const { error: insertErr } = await supabase
      .from('access_requests')
      .insert({ email, full_name, status: 'pending' });
    if (insertErr) throw insertErr;

    // TODO: notify admins by email once an email provider (e.g. Resend) is
    // wired up. For now new requests show up live in the admin panel's
    // "בקשות גישה" tab (realtime + the bell badge).

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
