#!/usr/bin/env python3
"""
Builds a one-time SQL import script that loads a Base44 data export (one CSV
per entity, as exported from the Base44 admin panel) into the current
KalagProMax Supabase schema (supabase/migrations/0001_init.sql plus
0003-0015).

Why this exists as a generator rather than a hand-written SQL file: Base44's
own row ids ("6aa1c4cc72f2848a151a92c0", a Mongo-style ObjectId) are not
valid Postgres `uuid` values, so every row needs a fresh uuid. Two tables
have a real foreign key between rows in this same export (gap_updates.gap_id
-> gaps.id, recurring_overrides.recurring_event_id -> recurring_events.id),
so the new uuid for a given source row has to be reproducible from its
original Base44 id alone, with no separate id-mapping table to keep around.
That's what uuid5(NAMESPACE, "<table>:<original id>") gives us: deterministic,
so re-running this generator against the same export (or a newer one that
still contains the same rows) always regenerates the same uuids.

Usage:
    python3 build_import_sql.py <csv_dir> <output.sql>

<csv_dir> must contain the 15 Base44 export CSVs, matched by filename
substring (see ENTITY_FILES below) - the "<hash>-<Entity>_export_1.csv"
naming Base44 uses is fine as-is.
"""
import csv
import json
import sys
import uuid
from pathlib import Path

# Fixed, arbitrary namespace UUID for this importer. Never change this once
# an import has been run for real - changing it would make every
# deterministic id this script generates come out different on a re-run,
# breaking the gaps<->gap_updates / recurring_events<->recurring_overrides
# cross-references against anything already imported.
NAMESPACE = uuid.UUID("6c6a6c61-6702-4d61-9873-6265343465e1")

# The Supabase account this entire import is attributed to (created_by_id on
# every row). Per the user's own instruction: point every imported row's
# created_by_id at this real auth.users id, since Base44's own
# created_by_id values (its internal user ids) don't correspond to any
# Supabase auth account and created_by_id is a foreign key to auth.users.
IMPORT_USER_ID = "6292bb9d-89e3-4054-a822-38960eeafa16"
IMPORT_LABEL = "יובא מ-Base44"

ENTITY_FILES = {
    "gaps": "-Gap_export",
    "gap_updates": "-GapUpdate_export",
    "recurring_events": "-RecurringEvent_export",
    "recurring_overrides": "-RecurringOverride_export",
    "task_completions": "-TaskCompletion_export",
    "direct_tasks": "-DirectTask_export",
    "events": "-Event_export",
    "daily_summaries": "-DailySummary_export",
    "daily_routines": "-DailyRoutine_export",
    "warehouse_items": "-WarehouseItem_export",
    "withdrawal_requests": "-WithdrawalRequest_export",
    "equipment_holdings": "-EquipmentHolding_export",
    "equipment_settings": "-EquipmentSettings_export",
    "constraints": "-Constraint_export",
    "access_requests": "-AccessRequest_export",
}

# Wipe children before parents; insert parents before children.
DELETE_ORDER = [
    "gap_updates", "gaps",
    "recurring_overrides", "recurring_events",
    "task_completions", "direct_tasks", "events",
    "daily_summaries", "daily_routines",
    "warehouse_items", "withdrawal_requests",
    "equipment_holdings", "equipment_settings",
    "constraints", "access_requests",
]
INSERT_ORDER = [
    "gaps", "recurring_events", "direct_tasks", "events",
    "daily_summaries", "daily_routines", "warehouse_items",
    "withdrawal_requests", "equipment_holdings", "equipment_settings",
    "constraints", "access_requests",
    "task_completions",
    "gap_updates", "recurring_overrides",
]


def new_id(table, original_id):
    return str(uuid.uuid5(NAMESPACE, f"{table}:{original_id}"))


def esc(s):
    return str(s).replace("'", "''")


def NULL():
    return "null"


def text_lit(v):
    if v is None:
        return NULL()
    v = str(v).strip()
    if v == "":
        return NULL()
    return "'" + esc(v) + "'"


def text_lit_keep_empty(v):
    """Like text_lit but an explicit empty string stays '' instead of NULL
    (only used where the schema wants a non-null text column with a
    meaningful empty value)."""
    if v is None:
        return NULL()
    return "'" + esc(v) + "'"


def num_lit(v, default="0"):
    if v is None or str(v).strip() == "":
        return default
    return str(v).strip()


def bool_lit(v, default="false"):
    if v is None or str(v).strip() == "":
        return default
    return "true" if str(v).strip().lower() == "true" else "false"


def ts_lit(v):
    if v is None or str(v).strip() == "":
        return "now()"
    return "'" + esc(v) + "'::timestamptz"


def parse_json(raw):
    if raw is None or str(raw).strip() == "":
        return None
    return json.loads(raw)


def array_lit(items):
    if not items:
        return "'{}'::text[]"
    return "array[" + ",".join("'" + esc(x) + "'" for x in items) + "]::text[]"


def jsonb_lit(obj):
    return "'" + esc(json.dumps(obj, ensure_ascii=False)) + "'::jsonb"


def read_csv(csv_dir, substring):
    matches = [p for p in Path(csv_dir).glob("*.csv") if substring in p.name]
    if not matches:
        raise SystemExit(f"No CSV found matching '{substring}' in {csv_dir}")
    if len(matches) > 1:
        raise SystemExit(f"Multiple CSVs match '{substring}' in {csv_dir}: {matches}")
    with open(matches[0], newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


# ---------------------------------------------------------------------------
# Per-table row -> (columns, values) builders
# ---------------------------------------------------------------------------

def row_gaps(r):
    cols = ["id", "company", "gap", "location", "class_name", "building_number",
            "room_number", "status", "priority", "note", "reporter_name",
            "reporter_phone", "attachments", "created_by", "created_by_id",
            "created_date", "updated_date"]
    attachments = parse_json(r["attachments"])
    vals = [
        text_lit(new_id("gaps", r["id"])),
        text_lit(r["company"]),
        text_lit(r["gap"]),
        text_lit(r["location"]),
        text_lit(r["class_name"]),
        text_lit(r["building_number"]),
        text_lit(r["room_number"]),
        text_lit(r["status"]) if r["status"].strip() else "'טרם הועלה'",
        text_lit(r["priority"]) if r["priority"].strip() else "'בינוני'",
        text_lit(r["note"]),
        text_lit(r["reporter_name"]),
        text_lit(r["reporter_phone"]),
        jsonb_lit(attachments if attachments is not None else []),
        text_lit(IMPORT_LABEL),
        text_lit(IMPORT_USER_ID),
        ts_lit(r["created_date"]),
        ts_lit(r["updated_date"]),
    ]
    return cols, vals


def row_gap_updates(r):
    cols = ["id", "gap_id", "update_type", "field", "old_value", "new_value",
            "text", "author_name", "created_by", "created_by_id",
            "created_date", "updated_date"]
    vals = [
        text_lit(new_id("gap_updates", r["id"])),
        text_lit(new_id("gaps", r["gap_id"])),
        text_lit(r["update_type"]) if r["update_type"].strip() else "'תגובה'",
        text_lit(r["field"]),
        text_lit(r["old_value"]),
        text_lit(r["new_value"]),
        text_lit(r["text"]),
        text_lit(r["author_name"]),
        text_lit(IMPORT_LABEL),
        text_lit(IMPORT_USER_ID),
        ts_lit(r["created_date"]),
        ts_lit(r["updated_date"]),
    ]
    return cols, vals


def row_recurring_events(r):
    cols = ["id", "title", "start_time", "end_time", "recurrence", "pluga",
            "details", "created_by", "created_by_id", "created_date", "updated_date"]
    vals = [
        text_lit(new_id("recurring_events", r["id"])),
        text_lit(r["title"]),
        text_lit(r["start_time"]),
        text_lit(r["end_time"]),
        text_lit(r["recurrence"]),
        text_lit(r["pluga"]),
        text_lit(r["details"]),
        text_lit(IMPORT_LABEL),
        text_lit(IMPORT_USER_ID),
        ts_lit(r["created_date"]),
        ts_lit(r["updated_date"]),
    ]
    return cols, vals


def row_recurring_overrides(r):
    cols = ["id", "recurring_event_id", "original_date", "new_date",
            "created_by", "created_by_id", "created_date", "updated_date"]
    vals = [
        text_lit(new_id("recurring_overrides", r["id"])),
        text_lit(new_id("recurring_events", r["recurring_event_id"])),
        text_lit(r["original_date"]),
        text_lit(r["new_date"]),
        text_lit(IMPORT_LABEL),
        text_lit(IMPORT_USER_ID),
        ts_lit(r["created_date"]),
        ts_lit(r["updated_date"]),
    ]
    return cols, vals


def row_direct_tasks(r):
    cols = ["id", "title", "pluga", "responsible_plugas", "task_date",
            "start_time", "end_time", "status", "notes", "created_by",
            "created_by_id", "created_date", "updated_date"]
    resp = parse_json(r["responsible_plugas"]) or []
    vals = [
        text_lit(new_id("direct_tasks", r["id"])),
        text_lit(r["title"]),
        text_lit(r["pluga"]),
        array_lit(resp),
        text_lit(r["task_date"]),
        text_lit(r["start_time"]),
        text_lit(r["end_time"]),
        text_lit(r["status"]) if r["status"].strip() else "'פתוחה'",
        text_lit(r["notes"]),
        text_lit(IMPORT_LABEL),
        text_lit(IMPORT_USER_ID),
        ts_lit(r["created_date"]),
        ts_lit(r["updated_date"]),
    ]
    return cols, vals


def row_events(r):
    cols = ["id", "event_type", "event_date", "start_time", "end_time",
            "title", "details", "transport_pluga", "transport_details",
            "food_pluga", "food_details", "responsible_plugas",
            "created_by", "created_by_id", "created_date", "updated_date"]
    resp = parse_json(r["responsible_plugas"]) or []
    vals = [
        text_lit(new_id("events", r["id"])),
        text_lit(r["event_type"]),
        text_lit(r["event_date"]),
        text_lit(r["start_time"]),
        text_lit(r["end_time"]),
        text_lit(r["title"]),
        text_lit(r["details"]),
        text_lit(r["transport_pluga"]),
        text_lit(r["transport_details"]),
        text_lit(r["food_pluga"]),
        text_lit(r["food_details"]),
        array_lit(resp),
        text_lit(IMPORT_LABEL),
        text_lit(IMPORT_USER_ID),
        ts_lit(r["created_date"]),
        ts_lit(r["updated_date"]),
    ]
    return cols, vals


def row_daily_summaries(r):
    cols = ["id", "summary_date", "entries", "created_by", "created_by_id",
            "created_date", "updated_date"]
    raw_entries = parse_json(r["entries"]) or []
    # Normalize every entry to the CURRENT shape ({areas: [...], pluga,
    # notes}) rather than leaving old exports in the legacy {area, notes}
    # shape - see entryAreas() in src/pages/DailySummary.jsx /
    # src/components/klaf/KlafSummary.jsx, which reads both, but there's no
    # reason for newly-imported historical data to rely on the back-compat
    # branch forever.
    normalized = []
    for e in raw_entries:
        if isinstance(e.get("areas"), list):
            areas = e["areas"]
        elif e.get("area"):
            areas = [e["area"]]
        else:
            areas = []
        normalized.append({"areas": areas, "pluga": e.get("pluga"), "notes": e.get("notes")})
    vals = [
        text_lit(new_id("daily_summaries", r["id"])),
        text_lit(r["summary_date"]),
        jsonb_lit(normalized),
        text_lit(IMPORT_LABEL),
        text_lit(IMPORT_USER_ID),
        ts_lit(r["created_date"]),
        ts_lit(r["updated_date"]),
    ]
    return cols, vals


def row_daily_routines(r):
    cols = ["id", "routine_date", "morning_assembly_plugas", "frisa_morning",
            "noon_cleaning", "evening_cleaning", "created_by", "created_by_id",
            "created_date", "updated_date"]
    plugas = parse_json(r["morning_assembly_plugas"]) or []
    vals = [
        text_lit(new_id("daily_routines", r["id"])),
        text_lit(r["routine_date"]),
        array_lit(plugas),
        text_lit(r["frisa_morning"]) if r["frisa_morning"].strip() else "'טרם הוחלט'",
        text_lit(r["noon_cleaning"]) if r["noon_cleaning"].strip() else "'טרם הוחלט'",
        text_lit(r["evening_cleaning"]) if r["evening_cleaning"].strip() else "'טרם הוחלט'",
        text_lit(IMPORT_LABEL),
        text_lit(IMPORT_USER_ID),
        ts_lit(r["created_date"]),
        ts_lit(r["updated_date"]),
    ]
    return cols, vals


def row_warehouse_items(r):
    cols = ["id", "warehouse", "name", "quantity", "returnable",
            "created_by", "created_by_id", "created_date", "updated_date"]
    vals = [
        text_lit(new_id("warehouse_items", r["id"])),
        text_lit(r["warehouse"]),
        text_lit(r["name"].strip()),
        num_lit(r["quantity"]),
        bool_lit(r["returnable"]),
        text_lit(IMPORT_LABEL),
        text_lit(IMPORT_USER_ID),
        ts_lit(r["created_date"]),
        ts_lit(r["updated_date"]),
    ]
    return cols, vals


def row_withdrawal_requests(r):
    cols = ["id", "warehouse", "items", "requested_by_name", "pluga",
            "request_date", "expected_return_date", "notes", "status",
            "approved_by_name", "created_by", "created_by_id",
            "created_date", "updated_date"]
    items = parse_json(r["items"]) or []
    vals = [
        text_lit(new_id("withdrawal_requests", r["id"])),
        text_lit(r["warehouse"]),
        jsonb_lit(items),
        text_lit(r["requested_by_name"]),
        text_lit(r["pluga"]),
        text_lit(r["request_date"]),
        text_lit(r["expected_return_date"]),
        text_lit(r["notes"]),
        text_lit(r["status"]) if r["status"].strip() else "'pending'",
        text_lit(r["approved_by_name"]),
        text_lit(IMPORT_LABEL),
        text_lit(IMPORT_USER_ID),
        ts_lit(r["created_date"]),
        ts_lit(r["updated_date"]),
    ]
    return cols, vals


def row_equipment_holdings(r):
    cols = ["id", "item_name", "warehouse", "quantity", "pluga",
            "held_by_name", "withdrawal_date", "expected_return_date",
            "created_by", "created_by_id", "created_date", "updated_date"]
    vals = [
        text_lit(new_id("equipment_holdings", r["id"])),
        text_lit(r["item_name"]),
        text_lit(r["warehouse"]),
        num_lit(r["quantity"]),
        text_lit(r["pluga"]),
        text_lit(r["held_by_name"]),
        text_lit(r["withdrawal_date"]),
        text_lit(r["expected_return_date"]),
        text_lit(IMPORT_LABEL),
        text_lit(IMPORT_USER_ID),
        ts_lit(r["created_date"]),
        ts_lit(r["updated_date"]),
    ]
    return cols, vals


def row_equipment_settings(r):
    cols = ["id", "responsible_klaf_id", "responsible_klaf_name",
            "notification_emails", "created_by", "created_by_id",
            "created_date", "updated_date"]
    emails = parse_json(r["notification_emails"]) or []
    vals = [
        text_lit(new_id("equipment_settings", r["id"])),
        text_lit(r["responsible_klaf_id"]),
        text_lit(r["responsible_klaf_name"]),
        array_lit(emails),
        text_lit(IMPORT_LABEL),
        text_lit(IMPORT_USER_ID),
        ts_lit(r["created_date"]),
        ts_lit(r["updated_date"]),
    ]
    return cols, vals


def row_constraints(r):
    cols = ["id", "pluga", "plugas", "constraint_date", "start_time",
            "end_time", "title", "details", "created_by", "created_by_id",
            "created_date", "updated_date"]
    plugas = parse_json(r.get("plugas", "")) or []
    vals = [
        text_lit(new_id("constraints", r["id"])),
        text_lit(r.get("pluga")),
        array_lit(plugas),
        text_lit(r["constraint_date"]),
        text_lit(r["start_time"]),
        text_lit(r["end_time"]),
        text_lit(r["title"]),
        text_lit(r.get("details")),
        text_lit(IMPORT_LABEL),
        text_lit(IMPORT_USER_ID),
        ts_lit(r["created_date"]),
        ts_lit(r["updated_date"]),
    ]
    return cols, vals


# NOTE: an earlier version of this script "corrected" this role value from
# a plain פ (U+05E4) to the grammatically-correct final-form ף (U+05E3),
# reasoning from supabase/migrations/0001_init.sql's CHECK constraint text
# (assigned_role in ('קלף', ...), written with ף). That was backwards: the
# live Supabase project rejected the "corrected" ף value outright (real
# error from actually running the import), while the app's own source code
# overwhelmingly writes/reads this role with the plain פ this export
# already uses (src/components/AdminPanel.jsx, TopNav.jsx, AppLayout.jsx,
# WarehouseItemForm.jsx, Klaf.jsx, Equipment.jsx, src/testdata/fixtures.js -
# only two files use ף). The migration file's own literal is evidently out
# of sync with what's actually deployed - left untouched here since fixing
# that is a schema question, not a data-import one - so this export's
# original value is passed through unchanged rather than "fixed" again.
ASSIGNED_ROLE_FIXES = {}


def row_access_requests(r):
    cols = ["id", "email", "full_name", "status", "assigned_role", "pluga",
            "created_by", "created_by_id", "created_date", "updated_date"]
    role = r["assigned_role"]
    role = ASSIGNED_ROLE_FIXES.get(role, role)
    vals = [
        text_lit(new_id("access_requests", r["id"])),
        text_lit_keep_empty(r["email"]),
        text_lit(r["full_name"]),
        text_lit(r["status"]) if r["status"].strip() else "'pending'",
        text_lit(role),
        text_lit(r["pluga"]),
        text_lit(IMPORT_LABEL),
        text_lit(IMPORT_USER_ID),
        ts_lit(r["created_date"]),
        ts_lit(r["updated_date"]),
    ]
    return cols, vals


def row_task_completions(r):
    cols = ["id", "task_type", "task_id", "task_field", "task_label",
            "task_date", "pluga", "created_by", "created_by_id",
            "created_date", "updated_date"]
    task_type = r["task_type"].strip()
    orig_task_id = r["task_id"]
    task_field = r["task_field"]
    if task_type == "event":
        task_id = new_id("events", orig_task_id)
    elif task_type == "direct":
        task_id = new_id("direct_tasks", orig_task_id)
        task_field = task_id  # direct completions key task_field == task_id, see Klaf.jsx
    elif task_type == "shotaf":
        task_id = new_id("daily_routines", orig_task_id)
    else:
        task_id = orig_task_id  # unknown type - leave as-is rather than guess
    vals = [
        text_lit(new_id("task_completions", r["id"])),
        text_lit(task_type),
        text_lit(task_id),
        text_lit(task_field),
        text_lit(r["task_label"]),
        text_lit(r["task_date"]),
        text_lit(r["pluga"]),
        text_lit(IMPORT_LABEL),
        text_lit(IMPORT_USER_ID),
        ts_lit(r["created_date"]),
        ts_lit(r["updated_date"]),
    ]
    return cols, vals


ROW_BUILDERS = {
    "gaps": row_gaps,
    "gap_updates": row_gap_updates,
    "recurring_events": row_recurring_events,
    "recurring_overrides": row_recurring_overrides,
    "task_completions": row_task_completions,
    "direct_tasks": row_direct_tasks,
    "events": row_events,
    "daily_summaries": row_daily_summaries,
    "daily_routines": row_daily_routines,
    "warehouse_items": row_warehouse_items,
    "withdrawal_requests": row_withdrawal_requests,
    "equipment_holdings": row_equipment_holdings,
    "equipment_settings": row_equipment_settings,
    "constraints": row_constraints,
    "access_requests": row_access_requests,
}


def build(csv_dir, out_path):
    tables = {}
    for table, substr in ENTITY_FILES.items():
        rows = read_csv(csv_dir, substr)
        tables[table] = rows

    # gap_updates / recurring_overrides can reference a parent row that was
    # itself deleted in Base44 after the update-log entry was written but
    # before this export was taken (the two collections were exported
    # independently, not as one consistent snapshot). The parent's own
    # export simply won't contain that id. Since gap_id / recurring_event_id
    # are real foreign keys here, such an orphaned row can never be
    # inserted - drop it, rather than fabricate a placeholder parent row.
    skipped_notes = []
    gap_ids = {r["id"] for r in tables["gaps"]}
    kept, dropped = [], []
    for r in tables["gap_updates"]:
        (kept if r["gap_id"] in gap_ids else dropped).append(r)
    tables["gap_updates"] = kept
    for r in dropped:
        skipped_notes.append(
            f"-- Skipped gap_updates id={r['id']}: its gap_id {r['gap_id']} does not "
            f"exist in the Gap export (that gap was presumably deleted in Base44 "
            f"after this update-log entry was written)."
        )

    recurring_event_ids = {r["id"] for r in tables["recurring_events"]}
    kept, dropped = [], []
    for r in tables["recurring_overrides"]:
        (kept if r["recurring_event_id"] in recurring_event_ids else dropped).append(r)
    tables["recurring_overrides"] = kept
    for r in dropped:
        skipped_notes.append(
            f"-- Skipped recurring_overrides id={r['id']}: its recurring_event_id "
            f"{r['recurring_event_id']} does not exist in the RecurringEvent export."
        )

    lines = []
    lines.append("-- ============================================================================")
    lines.append("-- ONE-TIME DATA IMPORT — Base44 production export -> Supabase")
    lines.append("-- Generated by supabase/data-import/build_import_sql.py — do not hand-edit;")
    lines.append("-- re-run the generator against a fresh export instead.")
    lines.append("--")
    lines.append("-- This is NOT a schema migration (nothing here touches table structure) and")
    lines.append("-- is meant to run exactly once, after supabase/migrations/0015 has been")
    lines.append("-- applied. It REPLACES the current contents of the 15 tables listed below")
    lines.append("-- with the Base44 export, per an explicit choice to make Supabase's data")
    lines.append("-- match that export exactly rather than merge with whatever is there now.")
    lines.append("--")
    lines.append("-- WARNING - read before running:")
    lines.append("--  * This deletes ALL current rows in: " + ", ".join(DELETE_ORDER) + ".")
    lines.append("--  * Deleting `events` cascades to `event_contacts` and `event_confirmations`")
    lines.append("--    (0004_event_contacts_confirmations.sql) for any of THOSE rows that")
    lines.append("--    point at an event being deleted — Base44 never had that feature, so")
    lines.append("--    this export can't restore them. If real confirmation/contact data")
    lines.append("--    already exists in Supabase for current events, back it up first.")
    lines.append("--  * Every imported row is attributed to created_by_id = '"
                  + IMPORT_USER_ID + "'")
    lines.append("--    (must already exist in auth.users — checked below before anything runs).")
    lines.append("--  * All ids are freshly generated (Base44's own ids aren't valid Postgres")
    lines.append("--    uuids) via uuid5, deterministically from each row's original Base44 id —")
    lines.append("--    re-running this generator against the same export reproduces the same")
    lines.append("--    ids, so gaps<->gap_updates and recurring_events<->recurring_overrides")
    lines.append("--    cross-references stay correct, and so does task_completions.task_id")
    lines.append("--    (remapped to the new events/direct_tasks/daily_routines id it points at).")
    lines.append("-- ============================================================================")
    if skipped_notes:
        lines.append("--")
        lines.append("-- Rows dropped from this export (orphaned foreign keys - see comment on each):")
        lines.extend(skipped_notes)
        lines.append("-- ----------------------------------------------------------------------------")
    lines.append("")
    lines.append("begin;")
    lines.append("")
    lines.append("-- Preflight 1: the attribution account must be a real auth user.")
    lines.append("do $$")
    lines.append("begin")
    lines.append(f"  if not exists (select 1 from auth.users where id = '{IMPORT_USER_ID}') then")
    lines.append(f"    raise exception 'Import aborted: created_by_id {IMPORT_USER_ID} not found in auth.users. Update IMPORT_USER_ID in build_import_sql.py and regenerate, or create that user first.';")
    lines.append("  end if;")
    lines.append("end $$;")
    lines.append("")
    lines.append("-- Preflight 2: 0015_task_completions_direct_type.sql must already be applied")
    lines.append("-- (this export contains task_type = 'direct' rows the old CHECK constraint rejects).")
    lines.append("do $$")
    lines.append("begin")
    lines.append("  if not exists (")
    lines.append("    select 1 from pg_constraint")
    lines.append("    where conname = 'task_completions_task_type_check'")
    lines.append("      and pg_get_constraintdef(oid) like '%direct%'")
    lines.append("  ) then")
    lines.append("    raise exception 'Import aborted: run supabase/migrations/0015_task_completions_direct_type.sql first.';")
    lines.append("  end if;")
    lines.append("end $$;")
    lines.append("")
    lines.append("-- ---------------------------------------------------------------------------")
    lines.append("-- Wipe (children before parents)")
    lines.append("-- ---------------------------------------------------------------------------")
    for table in DELETE_ORDER:
        lines.append(f"delete from public.{table};")
    lines.append("")
    lines.append("-- ---------------------------------------------------------------------------")
    lines.append("-- Insert (parents before children)")
    lines.append("-- ---------------------------------------------------------------------------")
    total = 0
    for table in INSERT_ORDER:
        rows = tables[table]
        if not rows:
            lines.append(f"-- {table}: 0 rows in this export, nothing to insert.")
            lines.append("")
            continue
        builder = ROW_BUILDERS[table]
        cols, first_vals = builder(rows[0])
        lines.append(f"insert into public.{table} ({', '.join(cols)}) values")
        value_lines = ["  (" + ", ".join(first_vals) + ")"]
        for r in rows[1:]:
            _, vals = builder(r)
            value_lines.append("  (" + ", ".join(vals) + ")")
        lines.append(",\n".join(value_lines) + ";")
        lines.append("")
        total += len(rows)

    lines.append("commit;")
    lines.append("")
    lines.append(f"-- Total rows imported: {total}")

    Path(out_path).write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out_path} ({total} rows across {sum(1 for t in INSERT_ORDER if tables[t])} tables)")
    for note in skipped_notes:
        print(note)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    build(sys.argv[1], sys.argv[2])
