import { getSupabaseAdmin, getCallerProfile } from './_lib/supabaseAdmin.js';
import { sendPushToSubscriptions } from './_lib/webPush.js';

// Admin-only: push-notifies every subscribed device about an announcement
// that was already created client-side (src/components/AdminPanel.jsx's
// "הודעות" tab, via base44.entities.Announcement.create — same pattern as
// every other admin-managed table). This function only handles the actual
// Web Push send, which needs the VAPID private key and so can't happen in
// the browser.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = getSupabaseAdmin();
    const caller = await getCallerProfile(req, supabase);
    if (!caller || caller.profile?.role !== 'admin') {
      return res.status(403).json({ error: 'רק מנהלים יכולים להפיץ הודעות' });
    }

    const { announcement_id } = req.body || {};
    if (!announcement_id) return res.status(400).json({ error: 'Missing announcement_id' });

    const { data: announcement, error: annError } = await supabase
      .from('announcements')
      .select('*')
      .eq('id', announcement_id)
      .maybeSingle();
    if (annError) throw annError;
    if (!announcement) return res.status(404).json({ error: 'ההודעה לא נמצאה' });

    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth');
    if (subError) throw subError;

    const { sent, removed } = await sendPushToSubscriptions(supabase, subscriptions || [], {
      title: `הודעה: ${announcement.title}`,
      body: announcement.body,
      url: '/',
      tag: 'announcement',
    });

    return res.status(200).json({ success: true, sent, removed, totalSubscriptions: (subscriptions || []).length });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
