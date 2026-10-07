import { getSupabaseAdmin, getCallerProfile } from './_lib/supabaseAdmin.js';

// Saves (or refreshes) a browser's Web Push subscription against the
// signed-in user, so api/send-daily-tasks-push.js (7:00 daily reminder) and
// api/publish-announcement.js (admin broadcasts) can push to it later. Any
// signed-in user may call this — it's their own subscription.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = getSupabaseAdmin();
    const caller = await getCallerProfile(req, supabase);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });

    const { subscription } = req.body || {};
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'חסרים פרטי המנוי (subscription)' });
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: caller.user.id,
          endpoint,
          p256dh,
          auth,
        },
        { onConflict: 'endpoint' }
      );
    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
