// Test mode: when on, base44Client.js routes every entity call (and auth.me)
// to the in-memory fixture store in src/testdata/ instead of the real
// Supabase project — nothing is ever read from or written to Supabase while
// this is active. See src/testdata/fixtures.js + mockStore.js for what data
// is available, and README-SUPABASE.md for how to turn it on/off.
//
// The flag lives in localStorage (this browser/device only) so it survives
// a page reload but never reaches Supabase or any other device.
const STORAGE_KEY = "kalagTestMode";

export function isTestMode() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Storage unavailable (private browsing, locked down browser, ...) —
    // fail closed to the real app rather than throw.
    return false;
  }
}

export function enableTestMode() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Nothing we can do — test mode just won't persist a reload here.
  }
}

export function disableTestMode() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
