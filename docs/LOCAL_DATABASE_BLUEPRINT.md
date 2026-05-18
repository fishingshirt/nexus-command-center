# 🗄️ Nexus Local Database Migration — Blueprint

> **Goal:** Move all app data from browser `localStorage` + loose JSON files → **single SQLite database** on the host machine.
> **Principle:** Host owns the data. Browser is just a view. Works offline via service-worker cache.

---

## 📊 Why SQLite

| Requirement | SQLite |
|-------------|--------|
| Zero external dependencies | ✅ Single file, no daemon |
| Portable / backup-friendly | ✅ `.db` file can be copied, versioned with care |
| No extra Docker container | ✅ Lives inside the existing Python server |
| Structured queries | ✅ SQL + full-text search |
| Concurrent read-safe | ✅ WAL mode |

**Location:** `~/nexus-command-center/data/nexus.db`

---

## 🏗️ Database Schema

### Core Tables

```sql
-- Calendar Events
CREATE TABLE IF NOT EXISTS events (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT,
    start       TEXT NOT NULL,  -- ISO-8601
    "end"       TEXT,           -- ISO-8601 (quoted keyword)
    all_day     INTEGER DEFAULT 0,
    color       TEXT DEFAULT '#3b82f6',
    recurring   TEXT,           -- 'daily','weekly','monthly' or NULL
    category    TEXT DEFAULT 'personal',
    google_id   TEXT,           -- for two-way sync
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

-- Notes
CREATE TABLE IF NOT EXISTS notes (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    body        TEXT,
    folder      TEXT DEFAULT 'General',
    tags        TEXT,           -- JSON array string
    pinned      INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

-- To-Do Items
CREATE TABLE IF NOT EXISTS todos (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    list_name   TEXT DEFAULT 'Today',
    priority    TEXT DEFAULT 'medium',  -- low | medium | high | critical
    due_date    TEXT,                   -- ISO-8601 or NULL
    completed   INTEGER DEFAULT 0,
    recurring   TEXT,                   -- 'daily','weekly','monthly' or NULL
    subtasks    TEXT,                   -- JSON array string
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

-- Recipes (replaces localStorage)
CREATE TABLE IF NOT EXISTS recipes (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    ingredients TEXT,           -- JSON array
    instructions TEXT,          -- JSON array (ordered steps)
    tags        TEXT,           -- JSON array
    prep_time   INTEGER,        -- minutes
    cook_time   INTEGER,        -- minutes
    servings    INTEGER,
    image_url   TEXT,
    source_url  TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

-- Wishlist Items
CREATE TABLE IF NOT EXISTS wishlist_items (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    url         TEXT,
    notes       TEXT,
    priority    TEXT DEFAULT 'medium',  -- low | medium | high
    status      TEXT DEFAULT 'wanted',   -- wanted | purchased | cancelled
    price       REAL,
    image_url   TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

-- Bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    url         TEXT NOT NULL,
    folder      TEXT DEFAULT 'Uncategorized',
    tags        TEXT,           -- JSON array
    favicon     TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

-- Finance Transactions (migrate from finance.json)
CREATE TABLE IF NOT EXISTS finance_transactions (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,  -- income | expense | transfer
    amount      REAL NOT NULL,
    currency    TEXT DEFAULT 'USD',
    category    TEXT,
    description TEXT,
    account     TEXT,
    date        TEXT,           -- ISO-8601
    created_at  TEXT DEFAULT (datetime('now'))
);

-- Finance Accounts
CREATE TABLE IF NOT EXISTS finance_accounts (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT,           -- checking | savings | credit | investment | cash
    balance     REAL DEFAULT 0,
    currency    TEXT DEFAULT 'USD',
    created_at  TEXT DEFAULT (datetime('now'))
);

-- Chat Messages (Hermes bridge history)
CREATE TABLE IF NOT EXISTS chat_messages (
    id          TEXT PRIMARY KEY,
    role        TEXT NOT NULL,  -- user | assistant | system
    content     TEXT NOT NULL,
    chat_id     TEXT,           -- thread identifier
    metadata    TEXT,           -- JSON blob
    created_at  TEXT DEFAULT (datetime('now'))
);

-- Feedback Queue Items
CREATE TABLE IF NOT EXISTS feedback_items (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,  -- bug | feature | ux | other
    title       TEXT NOT NULL,
    body        TEXT,
    status      TEXT DEFAULT 'open',  -- open | in_review | resolved | closed
    priority    TEXT DEFAULT 'medium',
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

-- Usage Analytics (screen time, app opens)
CREATE TABLE IF NOT EXISTS usage_sessions (
    id          TEXT PRIMARY KEY,
    app         TEXT NOT NULL,
    duration_sec INTEGER,
    started_at  TEXT,
    ended_at    TEXT
);

-- Pomodoro / Focus Sessions
CREATE TABLE IF NOT EXISTS focus_sessions (
    id          TEXT PRIMARY KEY,
    duration_min INTEGER NOT NULL,
    completed   INTEGER DEFAULT 0,
    label       TEXT,
    started_at  TEXT,
    ended_at    TEXT
);

-- App Settings (key-value store for all apps)
CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT,
    updated_at  TEXT DEFAULT (datetime('now'))
);

-- System Metadata (DB version, migration tracking)
CREATE TABLE IF NOT EXISTS system_meta (
    key         TEXT PRIMARY KEY,
    value       TEXT
);
```

---

## 🔌 REST API Design

### Generic CRUD Endpoints

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/api/db/:table` | List all rows in table |
| `GET` | `/api/db/:table/:id` | Get single row |
| `POST` | `/api/db/:table` | Insert new row |
| `PUT` | `/api/db/:table/:id` | Update row |
| `DELETE` | `/api/db/:table/:id` | Delete row |
| `POST` | `/api/db/:table/bulk` | Bulk insert/update |
| `POST` | `/api/db/sync` | Full sync push/pull |

### Query Parameters (GET list)
- `?folder=Work` — filter by folder
- `?list_name=Today` — filter by list
- `?completed=0` — filter boolean
- `?search=keyword` — full-text search (notes, todos, recipes)
- `?sort=updated_at&order=desc` — sorting
- `?limit=50&offset=0` — pagination

### Special Endpoints

| Path | Purpose |
|------|---------|
| `GET /api/db/search?q=keyword` | Cross-table search |
| `GET /api/db/backup` | Export entire DB as JSON blob |
| `POST /api/db/restore` | Import JSON blob (destructive) |
| `GET /api/db/stats` | Row counts per table |

---

## 📁 File Structure

```
nexus-command-center/
├── data/
│   ├── nexus.db              ← SQLite database (gitignored)
│   ├── nexus.db.bak          ← auto-backup copies
│   └── pdfs/                 ← existing PDF storage
├── scripts/
│   ├── nexus-server.py       ← extended with DB endpoints
│   └── nexus-db.py           ← NEW: SQLite module (schema + CRUD)
├── public/js/
│   ├── db-client.js          ← NEW: frontend DB API client
│   └── app.js                ← migrate per-app localStorage → db-client
└── docs/
    └── LOCAL_DATABASE_BLUEPRINT.md  ← this doc
```

---

## 🔄 Migration Strategy (Per-App)

### Phase 1: Foundation ✅ (this session)
- [ ] `nexus-db.py` — SQLite module with schema init
- [ ] `nexus-server.py` — REST CRUD endpoints
- [ ] `db-client.js` — frontend fetch wrapper

### Phase 2: App Migration (subsequent sessions)
- [ ] **Settings** — simplest, key-value store
- [ ] **Notes** — CRUD + search
- [ ] **To-Do** — CRUD + lists + reorder
- [ ] **Calendar** — CRUD + recurrence
- [ ] **Recipes** — CRUD + ingredients/steps
- [ ] **Wishlist** — CRUD + status filtering
- [ ] **Bookmarks** — CRUD + folders
- [ ] **Finance** — migrate from `finance.json`
- [ ] **Chat History** — replace localStorage
- [ ] **Feedback** — migrate from `data/feedback-queue.jsonl`
- [ ] **Usage Analytics** — replace localStorage
- [ ] **Focus Sessions** — replace localStorage

### Phase 3: Polish
- [ ] localStorage → offline cache layer (reads DB, falls back to cache when offline)
- [ ] Auto-backup: nightly `.db` copy to `data/nexus.db.bak.YYYYMMDD`
- [ ] Data migration script: one-time export from localStorage JSON → SQLite

---

## 🛡️ Safety & Rules

1. **DB file is gitignored.** Never commit `nexus.db`. Code that creates it is committed.
2. **WAL mode enabled.** Allows reads during writes (concurrent browser tabs).
3. **Every write gets an `updated_at` trigger.** Automatic timestamp tracking.
4. **IDs are UUID4 strings.** No auto-increment integers — portable, merge-safe.
5. **JSON columns store arrays/objects.** SQLite has native JSON functions (`json_array`, `json_extract`).
6. **Backup on every schema migration.** If schema changes, copy old DB before `ALTER TABLE`.
7. **Server startup:** DB auto-initializes if missing. Zero manual setup.

---

## 🧪 Verification Checklist

- [ ] `curl http://localhost:8080/api/db/stats` returns row counts
- [ ] `POST /api/db/notes` creates a note, `GET /api/db/notes` returns it
- [ ] Deleting browser localStorage data does NOT lose app data
- [ ] Server restart preserves all data
- [ ] Multiple browser tabs can read/write simultaneously
- [ ] Database file survives Docker container restarts (host volume mount)

---

*Blueprint v1.0 — 2026-05-18*
*Next step: Implement Phase 1 (database module + server endpoints + frontend client)*
