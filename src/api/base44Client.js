// Compatibility shim: every page/component in this app was written against
// the Base44 SDK's `base44` object (`base44.entities.X`, `base44.auth.*`,
// `base44.functions.invoke`, `base44.integrations.Core.*`, `base44.users.*`).
// Rather than touch every call site, this file re-implements that same
// surface on top of Supabase, so the rest of the app is unchanged.
//
// Table names, RLS policies, and helper RPCs referenced here come from
// supabase/migrations/0001_init.sql — keep the two in sync if you add fields.

import { supabase } from '@/lib/supabaseClient';
import { isTestMode, disableTestMode } from '@/lib/testMode';
import { getMockEntity, getMockProfile, updateMockProfile } from '@/testdata/mockStore';

// ---------------------------------------------------------------------------
// entities
// ---------------------------------------------------------------------------

function applySort(query, sort) {
  if (!sort) return query;
  const sorts = Array.isArray(sort) ? sort : [sort];
  let q = query;
  for (const s of sorts) {
    const desc = s.startsWith('-');
    const col = desc ? s.slice(1) : s;
    q = q.order(col, { ascending: !desc });
  }
  return q;
}

async function currentUserStamp() {
  const { data: { user } } = await supabase.auth.getUser();
  return {
    created_by: user?.email ?? null,
    created_by_id: user?.id ?? null,
  };
}

function makeEntity(table, { stampOwner = true } = {}) {
  // Test mode (src/lib/testMode.js): every method below defers to an
  // in-memory store instead of touching Supabase at all — for every table,
  // not just the ones src/testdata/fixtures.js pre-seeds (an unlisted table
  // just starts out empty there). The check happens per call — not once at
  // module load — since which project (real vs. in-memory) to hit can
  // change at runtime.
  const mock = () => (isTestMode() ? getMockEntity(table) : null);

  return {
    async list(sort, limit) {
      const m = mock();
      if (m) return m.list(sort, limit);
      let q = supabase.from(table).select('*');
      q = applySort(q, sort);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },

    async filter(query = {}, sort, limit) {
      const m = mock();
      if (m) return m.filter(query, sort, limit);
      let q = supabase.from(table).select('*');
      for (const [key, value] of Object.entries(query)) {
        q = q.eq(key, value);
      }
      q = applySort(q, sort);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },

    async get(id) {
      const m = mock();
      if (m) return m.get(id);
      const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },

    async create(payload) {
      const m = mock();
      if (m) return m.create(payload);
      const row = stampOwner ? { ...payload, ...(await currentUserStamp()) } : payload;
      const { data, error } = await supabase.from(table).insert(row).select().single();
      if (error) throw error;
      return data;
    },

    async bulkCreate(payloads) {
      const m = mock();
      if (m) return m.bulkCreate(payloads);
      const stamp = stampOwner ? await currentUserStamp() : {};
      const rows = payloads.map((p) => ({ ...p, ...stamp }));
      const { data, error } = await supabase.from(table).insert(rows).select();
      if (error) throw error;
      return data;
    },

    async update(id, payload) {
      const m = mock();
      if (m) return m.update(id, payload);
      const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const m = mock();
      if (m) return m.delete(id);
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    subscribe(callback) {
      const m = mock();
      if (m) return m.subscribe(callback);
      const channel = supabase
        .channel(`public:${table}:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => callback())
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}

const entities = {
  AccessRequest: makeEntity('access_requests'),
  Constraint: makeEntity('constraints'),
  DailyRoutine: makeEntity('daily_routines'),
  DailySummary: makeEntity('daily_summaries'),
  DirectTask: makeEntity('direct_tasks'),
  EquipmentHolding: makeEntity('equipment_holdings'),
  EquipmentSettings: makeEntity('equipment_settings'),
  Event: makeEntity('events'),
  EventContact: makeEntity('event_contacts'),
  EventConfirmation: makeEntity('event_confirmations'),
  Gap: makeEntity('gaps'),
  GapUpdate: makeEntity('gap_updates'),
  RecurringEvent: makeEntity('recurring_events'),
  RecurringOverride: makeEntity('recurring_overrides'),
  TaskCompletion: makeEntity('task_completions'),
  User: makeEntity('profiles', { stampOwner: false }),
  WarehouseItem: makeEntity('warehouse_items'),
  WithdrawalRequest: makeEntity('withdrawal_requests'),
  // Delegated-permissions feature (see supabase/migrations/0005_delegated_permissions.sql
  // and src/lib/permissions.js). stampOwner here records which admin granted
  // the permission (created_by/created_by_id) — user_id is the separate
  // grantee column.
  UserPermission: makeEntity('user_permissions'),
  PlayboxOrder: makeEntity('playbox_orders'),
  MealRegulator: makeEntity('meal_regulators'),
};

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

async function getCurrentProfile() {
  if (isTestMode()) return getMockProfile();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const err = new Error('Not authenticated');
    err.status = 401;
    throw err;
  }
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile || !profile.role) {
    // Mirrors Base44's app-level 403 for a signed-in user who isn't an app
    // user yet — AuthContext / ProtectedRoute key off this exact shape to
    // show the "request access" screen instead of the app.
    const err = new Error('User not registered for this app');
    err.status = 403;
    err.data = { extra_data: { reason: 'user_not_registered' } };
    throw err;
  }
  return { ...profile, email: profile.email || user.email };
}

async function register({ email, password }) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

async function verifyOtp({ email, otpCode }) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'signup' });
  if (error) throw error;
  return { access_token: data?.session?.access_token || null };
}

async function resendOtp(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

// eslint-disable-next-line no-unused-vars
function setToken(_token) {
  // No-op: supabase-js already holds the session established by verifyOtp /
  // signInWithOAuth / signInWithPassword. Kept only so callers don't need to
  // change.
}

async function loginWithProvider(provider, returnTo) {
  const redirectTo = `${window.location.origin}${returnTo || '/'}`;
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
  if (error) throw error;
}

async function resetPasswordRequest(email) {
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

async function resetPassword({ newPassword }) {
  // The recovery link the user clicked already established a temporary
  // Supabase session (supabase-js parses it from the URL on load), so no
  // separate token needs to be threaded through here.
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

async function me() {
  return getCurrentProfile();
}

async function updateMe(data) {
  if (isTestMode()) {
    updateMockProfile(data);
    return;
  }
  const keys = Object.keys(data);
  if (keys.length === 1 && keys[0] === 'notifications_last_read') {
    const { error } = await supabase.rpc('mark_notifications_read', { read_at: data.notifications_last_read });
    if (error) throw error;
    return;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('profiles').update(data).eq('id', user.id);
  if (error) throw error;
}

async function logout(redirectUrl) {
  if (isTestMode()) {
    // Test mode never opened a real Supabase session, so there's nothing to
    // sign out of — just turn test mode off and send them back to /login.
    disableTestMode();
    window.location.href = '/login';
    return;
  }
  await supabase.auth.signOut();
  if (redirectUrl) window.location.href = '/login';
}

function redirectToLogin(returnUrl) {
  const path = '/login' + (returnUrl ? '?returnTo=' + encodeURIComponent(returnUrl) : '');
  window.location.href = path;
}

async function isAuthenticated() {
  if (isTestMode()) return true;
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

const auth = {
  me,
  register,
  verifyOtp,
  resendOtp,
  setToken,
  loginWithProvider,
  resetPasswordRequest,
  resetPassword,
  updateMe,
  logout,
  redirectToLogin,
  isAuthenticated,
};

// ---------------------------------------------------------------------------
// functions.invoke — calls the Vercel serverless functions under /api that
// replace the three Base44 backend functions (see /api/*.js).
// ---------------------------------------------------------------------------

function toKebabCase(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

async function invoke(name, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/${toKebabCase(name)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.response = { data };
    throw err;
  }
  return data;
}

const functions = { invoke };

// ---------------------------------------------------------------------------
// integrations.Core — file uploads (replaces Base44's UploadPublicFile)
// ---------------------------------------------------------------------------

async function uploadPublicFile({ file }) {
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
  const path = `${crypto.randomUUID()}${ext}`;
  const { error } = await supabase.storage.from('attachments').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('attachments').getPublicUrl(path);
  return { file_url: data.publicUrl };
}

const integrations = {
  Core: {
    UploadPublicFile: uploadPublicFile,
  },
};

// ---------------------------------------------------------------------------
// users.inviteUser — admin-only, so it has to run server-side with the
// service-role key. See /api/invite-user.js.
// ---------------------------------------------------------------------------

async function inviteUser(email, platformRole) {
  return invoke('inviteUser', { email, platform_role: platformRole });
}

const users = { inviteUser };

export const base44 = {
  entities,
  auth,
  functions,
  integrations,
  users,
};
