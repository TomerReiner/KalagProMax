// The in-memory "database" behind test mode. Mirrors the Supabase tables
// listed in fixtures.js — the 6 original features (Klaf page, TopNav badge,
// daily schedule + constraints, backlog tasks, event confirmations, sticky
// nav), gaps and equipment/withdrawals, and the delegated-permissions
// feature (user_permissions, playbox_orders, meal_regulators — events.
// food_pickup_needed is just a plain column on the events table already
// covered above, not a table of its own). Nothing here ever calls Supabase;
// it's plain arrays in a JS module, reset on every full page load and
// whenever resetTestData() is called.
//
// Any table name not listed in fixtures.js (AccessRequest, the real
// User/profiles list, RecurringEvent, ...) still gets routed here while
// test mode is on (see the `mock()` check in base44Client.js — it applies
// per table, not per feature), it just starts out empty instead of
// pre-seeded. Either way nothing ever reaches the real Supabase project.
import { buildFixtures, buildProfile } from "./fixtures";

let db = null;
let profile = null;
const listeners = {}; // table name -> Set<() => void>

export function resetTestData() {
  db = buildFixtures();
  profile = buildProfile();
  // Let any already-mounted component (from before the reset) know its data
  // just changed, same as a real realtime event would.
  Object.keys(listeners).forEach(notify);
}

function ensureInit() {
  if (!db) resetTestData();
}

function notify(tableName) {
  const set = listeners[tableName];
  if (!set) return;
  set.forEach((cb) => {
    try {
      cb();
    } catch (err) {
      console.error(`[test mode] subscriber for ${tableName} threw:`, err);
    }
  });
}

function rowsOf(tableName) {
  ensureInit();
  if (!db[tableName]) db[tableName] = [];
  return db[tableName];
}

export function getMockProfile() {
  ensureInit();
  return { ...profile };
}

export function updateMockProfile(patch) {
  ensureInit();
  profile = { ...profile, ...patch, updated_date: new Date().toISOString() };
  return { ...profile };
}

function matchesQuery(row, query) {
  return Object.entries(query).every(([key, value]) => row[key] === value);
}

function applySort(rows, sort) {
  if (!sort) return rows;
  const sorts = Array.isArray(sort) ? sort : [sort];
  const sorted = [...rows];
  sorted.sort((a, b) => {
    for (const s of sorts) {
      const desc = s.startsWith("-");
      const col = desc ? s.slice(1) : s;
      const av = a[col];
      const bv = b[col];
      if (av === bv) continue;
      if (av == null) return desc ? -1 : 1;
      if (bv == null) return desc ? 1 : -1;
      if (av < bv) return desc ? 1 : -1;
      if (av > bv) return desc ? -1 : 1;
    }
    return 0;
  });
  return sorted;
}

// Deletes cascade the same way the real schema's `on delete cascade` does
// for event_contacts/event_confirmations -> events.
function cascadeDelete(tableName, id) {
  if (tableName !== "events") return;
  for (const child of ["event_contacts", "event_confirmations"]) {
    const rows = rowsOf(child);
    const kept = rows.filter((r) => r.event_id !== id);
    if (kept.length !== rows.length) {
      db[child] = kept;
      notify(child);
    }
  }
}

export function getMockEntity(tableName) {
  return {
    async list(sort, limit) {
      let rows = applySort(rowsOf(tableName), sort);
      if (limit) rows = rows.slice(0, limit);
      return rows.map((r) => ({ ...r }));
    },

    async filter(query = {}, sort, limit) {
      let rows = rowsOf(tableName).filter((r) => matchesQuery(r, query));
      rows = applySort(rows, sort);
      if (limit) rows = rows.slice(0, limit);
      return rows.map((r) => ({ ...r }));
    },

    async get(id) {
      const row = rowsOf(tableName).find((r) => r.id === id);
      return row ? { ...row } : null;
    },

    async create(payload) {
      const now = new Date().toISOString();
      const row = {
        created_by: "test-mode",
        created_by_id: null,
        created_date: now,
        updated_date: now,
        ...payload,
        id: payload?.id || crypto.randomUUID(),
      };
      rowsOf(tableName).push(row);
      notify(tableName);
      return { ...row };
    },

    async bulkCreate(payloads) {
      const now = new Date().toISOString();
      const created = payloads.map((p) => ({
        created_by: "test-mode",
        created_by_id: null,
        created_date: now,
        updated_date: now,
        ...p,
        id: p?.id || crypto.randomUUID(),
      }));
      rowsOf(tableName).push(...created);
      notify(tableName);
      return created.map((r) => ({ ...r }));
    },

    async update(id, payload) {
      const rows = rowsOf(tableName);
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) {
        throw new Error(`[test mode] ${tableName} row not found: ${id}`);
      }
      rows[idx] = { ...rows[idx], ...payload, updated_date: new Date().toISOString() };
      notify(tableName);
      return { ...rows[idx] };
    },

    async delete(id) {
      const rows = rowsOf(tableName);
      const idx = rows.findIndex((r) => r.id === id);
      if (idx !== -1) rows.splice(idx, 1);
      cascadeDelete(tableName, id);
      notify(tableName);
      return true;
    },

    subscribe(callback) {
      if (!listeners[tableName]) listeners[tableName] = new Set();
      listeners[tableName].add(callback);
      return () => listeners[tableName]?.delete(callback);
    },
  };
}
