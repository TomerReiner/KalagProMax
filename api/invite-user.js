import { getSupabaseAdmin, getCallerProfile } from './_lib/supabaseAdmin.js';

// Admin-only. Backs base44Client.js's `base44.users.inviteUser`, called from
// AdminPanel.jsx when approving an access request. Needs the service_role
// key (supabase.auth.admin.*), so it has to run server-side.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = getSupabaseAdmin();
    const caller = await getCallerProfile(req, supabase);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });
    if (caller.profile?.role !== 'admin') return res.status(403).json({ error: 'אין הרשאה' });

    const email = (req.body?.email || '').toString().trim().toLowerCase();
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'נדרש אימייל תקין' });

    // A person who already signed in once (e.g. with Google) already has an
    // auth user + a profiles row (role NULL until approved) — nothing to
    // create here. AdminPanel.jsx sets role/pluga right after this call
    // returns, for either branch.
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (existingProfile) {
      return res.status(200).json({ success: true, already_existed: true });
    }

    const { error } = await supabase.auth.admin.inviteUserByEmail(email);
    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
