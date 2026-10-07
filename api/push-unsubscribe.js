import { getSupabaseAdmin, getCallerProfile } from './_lib/supabaseAdmin.js';

// Removes one browser's Web Push subscription (called when the person turns
// off notifications for this device in the "אזור אישי" page). Scoped to the
// caller's own user_id as well as the endpoint, purely defensively — a push
// endpoint URL is already effectively unique per browser installation.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = getSupabaseAdmin();
    const caller = await getCallerProfile(req, supabase);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });

    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'חסר endpoint' });

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', caller.user.id);
    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
