import { createClient } from '@supabase/supabase-js';

// Server-only Supabase client using the service_role key — bypasses RLS, so
// every function below must check the caller's identity/role itself before
// touching data. Never import this file from src/ (client bundle).
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables (set them in Vercel project settings).');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Verifies the bearer token the frontend sent (base44Client.js's
// functions.invoke attaches the current Supabase session's access token) and
// returns { user, profile }, or null when there's no valid session.
export async function getCallerProfile(req, supabaseAdmin) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return { user, profile };
}
