import { getSupabaseAdmin, getCallerProfile } from './_lib/supabaseAdmin.js';
import { sendPushToSubscriptions } from './_lib/webPush.js';

// Every morning at 7:00 Israel time, push each קלפ a reminder of their
// pluga's open tasks for today. Server-side mirror of
// src/lib/useOpenTasksToday.js's algorithm (kept in sync manually — that
// hook is what drives the in-app nav badge/banner; this is the same
// computation, just run once here for every pluga instead of live in one
// person's browser).
//
// Vercel's free/hobby cron tier only fires once a day per schedule and
// always in UTC, but Israel alternates between UTC+2 (IST) and UTF+3 (IDT)
// across the year — a single fixed UTC cron would drift an hour twice a
// year. Instead, vercel.json registers TWO daily cron schedules (04:00 and
// 05:00 UTC, covering both possible UTC offsets for 7:00 Israel time), and
// this handler itself checks the actual current Israel-time hour and no-ops
// unless it's really 7am there — so only one of the two firings ever does
// anything on a given day.
//
// Two ways in:
//  1. Vercel Cron (GET), authorized via the Authorization: Bearer
//     <CRON_SECRET> header Vercel adds automatically once CRON_SECRET is set
//     as a project env var (see README-SUPABASE.md).
//  2. A manual admin test run (POST, with the caller's own session — admins
//     only), optionally with { force: true } to skip the "is it actually
//     7am in Israel right now" guard so it can be tested at any time of day.
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseAdmin();
    let force = false;

    if (req.method === 'GET') {
      if (!process.env.CRON_SECRET) {
        return res.status(500).json({ error: 'CRON_SECRET not configured' });
      }
      const authHeader = req.headers.authorization || '';
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } else {
      const caller = await getCallerProfile(req, supabase);
      if (!caller || caller.profile?.role !== 'admin') {
        return res.status(403).json({ error: 'Admins only' });
      }
      force = !!(req.body || {}).force;
    }

    const israelHour = Number(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hour: 'numeric', hourCycle: 'h23' }).format(new Date())
    );
    if (!force && israelHour !== 7) {
      return res.status(200).json({ skipped: true, reason: `not 7am Israel time (currently ${israelHour}:00)` });
    }

    // 'en-CA' formats as YYYY-MM-DD, matching the plain-text date columns
    // (routine_date / event_date / task_date) this app already uses.
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());

    // Only קלפ holders have a pluga on their profile (see AdminPanel.jsx's
    // handleApprove) — filtering on pluga rather than role avoids the role
    // string's own Hebrew-letter-form ambiguity (קלפ vs קלף — see
    // supabase/data-import/README.md) entirely.
    const [{ data: plugaProfiles, error: profilesError }, { data: routineData, error: routineError }, { data: eventData, error: eventError }, { data: completionData, error: completionError }, { data: directTaskData, error: directTaskError }] = await Promise.all([
      supabase.from('profiles').select('id, pluga').not('pluga', 'is', null),
      supabase.from('daily_routines').select('*').eq('routine_date', todayStr),
      supabase.from('events').select('*').eq('event_date', todayStr),
      supabase.from('task_completions').select('task_id, task_field').eq('task_date', todayStr),
      supabase.from('direct_tasks').select('*').eq('task_date', todayStr),
    ]);
    if (profilesError) throw profilesError;
    if (routineError) throw routineError;
    if (eventError) throw eventError;
    if (completionError) throw completionError;
    if (directTaskError) throw directTaskError;

    const routine = (routineData || [])[0] || null;
    const events = eventData || [];
    const directTasks = directTaskData || [];
    const completedKeys = new Set((completionData || []).map((c) => `${c.task_id}_${c.task_field}`));

    function openCountFor(pluga) {
      const relevantTasks = [];
      if (routine) {
        if (routine.frisa_morning === pluga) relevantTasks.push({ id: routine.id, field: 'frisa_morning' });
        if (routine.morning_assembly_plugas?.includes(pluga)) relevantTasks.push({ id: routine.id, field: 'morning_assembly_plugas' });
        if (routine.noon_cleaning === pluga) relevantTasks.push({ id: routine.id, field: 'noon_cleaning' });
        if (routine.evening_cleaning === pluga) relevantTasks.push({ id: routine.id, field: 'evening_cleaning' });
      }
      events.forEach((e) => {
        if (e.event_type === 'פנימי' && e.responsible_plugas?.includes(pluga)) relevantTasks.push({ id: e.id, field: 'responsible' });
        if (e.event_type === 'חיצוני') {
          if (e.transport_pluga === pluga) relevantTasks.push({ id: e.id, field: 'transport' });
          if (e.food_pluga === pluga) relevantTasks.push({ id: e.id, field: 'food' });
        }
      });
      directTasks
        .filter((dt) => dt.pluga === pluga || dt.responsible_plugas?.includes(pluga))
        .forEach((dt) => relevantTasks.push({ id: dt.id, field: dt.id }));
      return relevantTasks.filter((t) => !completedKeys.has(`${t.id}_${t.field}`)).length;
    }

    const userIds = (plugaProfiles || []).map((p) => p.id);
    const { data: subscriptions, error: subError } = userIds.length
      ? await supabase.from('push_subscriptions').select('user_id, endpoint, p256dh, auth').in('user_id', userIds)
      : { data: [], error: null };
    if (subError) throw subError;

    const subsByUser = new Map();
    (subscriptions || []).forEach((s) => {
      if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, []);
      subsByUser.get(s.user_id).push(s);
    });

    let totalSent = 0;
    let totalRemoved = 0;
    let usersNotified = 0;

    for (const profile of plugaProfiles || []) {
      const userSubs = subsByUser.get(profile.id);
      if (!userSubs || !userSubs.length) continue;
      const openCount = openCountFor(profile.pluga);
      if (openCount <= 0) continue;
      const { sent, removed } = await sendPushToSubscriptions(supabase, userSubs, {
        title: 'המשימות שלך להיום',
        body: `יש לך ${openCount} משימות פתוחות היום (${profile.pluga})`,
        url: '/klaf',
        tag: 'daily-tasks',
      });
      totalSent += sent;
      totalRemoved += removed;
      if (sent > 0) usersNotified += 1;
    }

    return res.status(200).json({ success: true, date: todayStr, usersNotified, totalSent, totalRemoved });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
