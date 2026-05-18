#!/usr/bin/env python3
"""Nexus Local Database — SQLite module for all app data.

Usage:
    import nexus_db
    db = nexus_db.get_db()          # returns sqlite3 Connection (row_factory=Row)
    nexus_db.init_schema(db)        # idempotent schema creation
    nexus_db.close_db(db)

All public functions return dicts/lists for JSON serialization.
"""
import sqlite3, json, uuid, os, time, re
from pathlib import Path

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'data', 'nexus.db'
)

VALID_TABLES = {
    'events', 'notes', 'todos', 'recipes', 'wishlist_items',
    'bookmarks', 'finance_transactions', 'finance_accounts',
    'chat_messages', 'feedback_items', 'usage_sessions',
    'focus_sessions', 'app_settings', 'system_meta',
    'weather_locations', 'worldclock_cities',
}

JSON_COLUMNS = {
    'events': ['recurring'],
    'notes': ['tags'],
    'todos': ['subtasks'],
    'recipes': ['ingredients', 'instructions', 'tags'],
    'wishlist_items': ['tags'],
    'bookmarks': ['tags'],
    'finance_transactions': ['metadata'],
    'chat_messages': ['metadata'],
    'feedback_items': ['metadata'],
    'app_settings': ['value'],
    'weather_locations': ['current', 'forecast'],
    'worldclock_cities': [],
}

# ── Connection ─────────────────────────────────────

def _connect():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn

_DB_CONN = None

def get_db():
    global _DB_CONN
    if _DB_CONN is None:
        _DB_CONN = _connect()
    return _DB_CONN

def close_db(conn=None):
    global _DB_CONN
    target = conn or _DB_CONN
    if target:
        target.close()
    if target is _DB_CONN:
        _DB_CONN = None

# ── Schema ─────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT,
    start       TEXT NOT NULL,
    "end"       TEXT,
    all_day     INTEGER DEFAULT 0,
    color       TEXT DEFAULT '#3b82f6',
    recurring   TEXT,
    category    TEXT DEFAULT 'personal',
    google_id   TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notes (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    body        TEXT,
    folder      TEXT DEFAULT 'General',
    tags        TEXT,
    pinned      INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS todos (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    list_name   TEXT DEFAULT 'Today',
    priority    TEXT DEFAULT 'medium',
    due_date    TEXT,
    completed   INTEGER DEFAULT 0,
    recurring   TEXT,
    subtasks    TEXT,
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recipes (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    ingredients TEXT,
    instructions TEXT,
    tags        TEXT,
    prep_time   INTEGER,
    cook_time   INTEGER,
    servings    INTEGER,
    image_url   TEXT,
    source_url  TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wishlist_items (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    url         TEXT,
    notes       TEXT,
    priority    TEXT DEFAULT 'medium',
    status      TEXT DEFAULT 'wanted',
    price       REAL,
    image_url   TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookmarks (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    url         TEXT NOT NULL,
    folder      TEXT DEFAULT 'Uncategorized',
    tags        TEXT,
    favicon     TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_transactions (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    amount      REAL NOT NULL,
    currency    TEXT DEFAULT 'USD',
    category    TEXT,
    description TEXT,
    account     TEXT,
    date        TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_accounts (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT,
    balance     REAL DEFAULT 0,
    currency    TEXT DEFAULT 'USD',
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id          TEXT PRIMARY KEY,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    chat_id     TEXT,
    metadata    TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feedback_items (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT,
    status      TEXT DEFAULT 'open',
    priority    TEXT DEFAULT 'medium',
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usage_sessions (
    id          TEXT PRIMARY KEY,
    app         TEXT NOT NULL,
    duration_sec INTEGER,
    started_at  TEXT,
    ended_at    TEXT
);

CREATE TABLE IF NOT EXISTS focus_sessions (
    id          TEXT PRIMARY KEY,
    duration_min INTEGER NOT NULL,
    completed   INTEGER DEFAULT 0,
    label       TEXT,
    started_at  TEXT,
    ended_at    TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT,
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS system_meta (
    key         TEXT PRIMARY KEY,
    value       TEXT
);

CREATE TABLE IF NOT EXISTS weather_locations (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    lat         REAL,
    lon         REAL,
    country     TEXT,
    is_home     INTEGER DEFAULT 0,
    current     TEXT,
    forecast    TEXT,
    updated     INTEGER,
    added_at    INTEGER,
    sort_order  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS worldclock_cities (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    country     TEXT,
    tz          TEXT NOT NULL,
    label       TEXT,
    sort_order  INTEGER DEFAULT 0
);
"""

def init_schema(conn=None):
    db = conn or get_db()
    db.executescript(SCHEMA)
    db.execute("INSERT OR IGNORE INTO system_meta (key, value) VALUES ('schema_version', '1')")
    db.execute("INSERT OR IGNORE INTO system_meta (key, value) VALUES ('created_at', datetime('now'))")
    db.commit()

# ── Serialization helpers ─────────────────────────

def _row_to_dict(row):
    if row is None:
        return None
    d = dict(row)
    # Decode known JSON columns
    table = None
    # We can't know the table from a bare Row, so caller handles this
    return d

def _decode_json_cols(table, d):
    cols = JSON_COLUMNS.get(table, [])
    for c in cols:
        if c in d and d[c] is not None and isinstance(d[c], str):
            try:
                d[c] = json.loads(d[c])
            except Exception:
                pass
    # Booleans stored as int
    bool_cols = {'all_day', 'completed', 'pinned'}
    for c in bool_cols & set(d.keys()):
        d[c] = bool(d[c])
    return d

def _encode_json_cols(table, d):
    cols = JSON_COLUMNS.get(table, [])
    for c in cols:
        if c in d and not isinstance(d[c], str):
            d[c] = json.dumps(d[c]) if d[c] is not None else None
    # Booleans to int
    bool_cols = {'all_day', 'completed', 'pinned'}
    for c in bool_cols & set(d.keys()):
        if isinstance(d[c], bool):
            d[c] = 1 if d[c] else 0
    return d

def _all_rows(conn, table):
    cur = conn.execute(f"SELECT * FROM {table} ORDER BY created_at DESC")
    rows = []
    for r in cur.fetchall():
        d = dict(r)
        rows.append(_decode_json_cols(table, d))
    return rows

def _get_by_id(conn, table, id):
    cur = conn.execute(f"SELECT * FROM {table} WHERE id = ?", (id,))
    r = cur.fetchone()
    if r is None:
        return None
    d = dict(r)
    return _decode_json_cols(table, d)

def _insert(conn, table, data):
    data = dict(data)
    if 'id' not in data or not data['id']:
        data['id'] = str(uuid.uuid4())
    data.setdefault('created_at', _now_iso())
    data.setdefault('updated_at', _now_iso())
    data = _encode_json_cols(table, data)
    cols = list(data.keys())
    vals = [data[c] for c in cols]
    ph = ','.join('?' * len(cols))
    sql = f"INSERT INTO {table} ({','.join(cols)}) VALUES ({ph})"
    conn.execute(sql, vals)
    conn.commit()
    return data['id']

def _update(conn, table, id, data):
    data = dict(data)
    data.pop('id', None)
    data.pop('created_at', None)
    data['updated_at'] = _now_iso()
    data = _encode_json_cols(table, data)
    if not data:
        return False
    sets = ','.join(f"{k}=?" for k in data)
    vals = list(data.values()) + [id]
    sql = f"UPDATE {table} SET {sets} WHERE id = ?"
    cur = conn.execute(sql, vals)
    conn.commit()
    return cur.rowcount > 0

def _delete(conn, table, id):
    cur = conn.execute(f"DELETE FROM {table} WHERE id = ?", (id,))
    conn.commit()
    return cur.rowcount > 0

def _now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

# ── Public CRUD API ────────────────────────────────

def list_rows(table, filters=None, search=None, sort='created_at', order='desc', limit=None, offset=None):
    if table not in VALID_TABLES:
        raise ValueError(f"Invalid table: {table}")
    conn = get_db()
    wheres = []
    vals = []
    if filters:
        for k, v in filters.items():
            if k in ('folder', 'list_name', 'category', 'priority', 'status', 'type', 'app', 'role'):
                wheres.append(f"{k} = ?")
                vals.append(v)
            elif k == 'completed':
                wheres.append(f"completed = ?")
                vals.append(1 if v in (True, 'true', '1', 1) else 0)
    if search and table in ('notes', 'todos', 'recipes', 'wishlist_items', 'bookmarks', 'feedback_items'):
        search_cols = {
            'notes': ['title', 'body'],
            'todos': ['title', 'notes'],
            'recipes': ['name', 'instructions'],
            'wishlist_items': ['title', 'notes'],
            'bookmarks': ['title', 'url'],
            'feedback_items': ['title', 'body'],
        }
        cols = search_cols.get(table, ['title'])
        clauses = ' OR '.join(f'{c} LIKE ?' for c in cols)
        wheres.append(f"({clauses})")
        like = f"%{search}%"
        vals.extend([like] * len(cols))
    sql = f"SELECT * FROM {table}"
    if wheres:
        sql += " WHERE " + " AND ".join(wheres)
    sql += f" ORDER BY {sort} {order}"
    if limit:
        sql += f" LIMIT {int(limit)}"
    if offset:
        sql += f" OFFSET {int(offset)}"
    cur = conn.execute(sql, vals)
    rows = []
    for r in cur.fetchall():
        d = dict(r)
        rows.append(_decode_json_cols(table, d))
    return rows

def get_row(table, id):
    if table not in VALID_TABLES:
        raise ValueError(f"Invalid table: {table}")
    return _get_by_id(get_db(), table, id)

def create_row(table, data):
    if table not in VALID_TABLES:
        raise ValueError(f"Invalid table: {table}")
    return _insert(get_db(), table, data)

def update_row(table, id, data):
    if table not in VALID_TABLES:
        raise ValueError(f"Invalid table: {table}")
    return _update(get_db(), table, id, data)

def delete_row(table, id):
    if table not in VALID_TABLES:
        raise ValueError(f"Invalid table: {table}")
    return _delete(get_db(), table, id)

def bulk_upsert(table, rows):
    """Insert or replace rows. Returns list of IDs."""
    if table not in VALID_TABLES:
        raise ValueError(f"Invalid table: {table}")
    conn = get_db()
    ids = []
    for row in rows:
        row = dict(row)
        if 'id' not in row or not row['id']:
            row['id'] = str(uuid.uuid4())
        row.setdefault('created_at', _now_iso())
        row.setdefault('updated_at', _now_iso())
        row = _encode_json_cols(table, row)
        cols = list(row.keys())
        vals = [row[c] for c in cols]
        ph = ','.join('?' * len(cols))
        sql = f"INSERT OR REPLACE INTO {table} ({','.join(cols)}) VALUES ({ph})"
        conn.execute(sql, vals)
        ids.append(row['id'])
    conn.commit()
    return ids

# ── Settings helpers ───────────────────────────────

def get_setting(key, default=None):
    conn = get_db()
    cur = conn.execute("SELECT value FROM app_settings WHERE key = ?", (key,))
    r = cur.fetchone()
    if r is None:
        return default
    try:
        return json.loads(r['value'])
    except Exception:
        return r['value']

def set_setting(key, value):
    conn = get_db()
    v = json.dumps(value) if not isinstance(value, str) else value
    conn.execute("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))", (key, v))
    conn.commit()

# ── Stats / Backup ─────────────────────────────────

def db_stats():
    conn = get_db()
    stats = {}
    for t in VALID_TABLES:
        cur = conn.execute(f"SELECT COUNT(*) AS c FROM {t}")
        stats[t] = cur.fetchone()['c']
    return stats

def export_json():
    conn = get_db()
    out = {}
    for t in VALID_TABLES:
        out[t] = _all_rows(conn, t)
    return out

def import_json(data, wipe=False):
    conn = get_db()
    if wipe:
        for t in VALID_TABLES:
            conn.execute(f"DELETE FROM {t}")
    for t, rows in data.items():
        if t not in VALID_TABLES or not isinstance(rows, list):
            continue
        for row in rows:
            try:
                _insert(conn, t, row)
            except Exception:
                pass
    conn.commit()
    return True

# ── Auto-init on import ───────────────────────────

try:
    init_schema()
except Exception:
    pass
