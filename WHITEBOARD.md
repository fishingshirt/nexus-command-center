# 🤖 AGENT WHITEBOARD — Nexus Command Center

> **This file is the single source of truth for the autonomous agent working on this project.**
> The agent reads this on every wake cycle, executes the top-priority tasks, updates progress here, and goes back to sleep.

---

## 📊 CURRENT STATUS

| Metric | Value |
|--------|-------|
|| **Project Phase** | `SECURITY & CLOUD` |
|||| **Last Agent Run** | 2026-05-09 (T-026-d — Tetromino game implemented: 7-bag randomizer, hold piece, next preview, ghost piece, line clear scoring with particles, keyboard + touch controls) |
|||| **Active Tasks** | 9 (T-025, T-026, T-027, T-028, T-031, T-032, T-036, T-038) |
||||| **Completed Tasks** | 63 (T-001 through T-008, T-009 + subtasks, T-010, T-011, T-014 + subtasks a–c, T-015, T-015-a, T-016, T-021-a/b/c, T-021, T-022, T-023, T-024 + subtasks a–f, T-029 + subtasks, T-030 + subtasks a–f, T-033 + subtasks a–g, T-026-a/b/c/d, T-034, T-035, T-037, T-036-a/c/d, T-038 + subtasks a–e) |
|||| **Current Focus:** T-026 (Arcade expansion — Minesweeper next) |
|||| **Current Focus:** T-026 (Arcade expansion — Minesweeper next) |

---

## 🎯 TASK BOARD (Priority Order — Top = Do First)

### 🔴 CRITICAL (Do These Now)
| ID | Task | Status | Notes |
|----|------|--------|-------|
| `T-001` | Build `index.html` — main dashboard shell with app grid, nav, chat widget placeholder | `DONE` | Must be mobile-first. Use semantic HTML. |
| `T-002` | Implement theme engine — CSS variables + 6 themes (Professional default + 5 alternates) | `DONE` | Themes: Professional, Midnight Hacker, Sakura Garden, Space Odyssey, Retro Arcade, Ocean Breeze. |
| `T-003` | Build Settings panel — theme switcher, reset welcome screen toggle | `DONE` | Settings stored in `localStorage`. |
| `T-004` | Create Welcome / Onboarding overlay — dramatic intro with music, tagline "Adapt. Learn. Build." | `DONE` | Must have a "Replay Intro" button in Settings. |
| `T-005` | Scaffold app containers — Calendar, Notes, To-Do, Chat | `DONE` | Empty shells with icons and grid layout. Make them pluggable. |
| `T-006` | Implement Chat widget — mini Hermes chat window with `/new` command | `DONE` | Fixed bottom-right. Persists message history to `localStorage`. |
| `T-007` | Add PWA support — `manifest.json`, service worker, icons for phone install | `DONE` | This is how it becomes "an app" on phone. |
| `T-008` | Dockerize — `Dockerfile` + `docker-compose.yml`, nginx static serve | `DONE` | Expose port 8080. Mount volume for data persistence. |

### 🟡 HIGH (Next Sprint)
| ID | Task | Status | Notes |
|----|------|--------|-------|
| `T-009` | Calendar app — full CRUD, month/week/day views, localStorage persistence | `IN_PROGRESS` | Month/week/day + CRUD + persistence done. Google Calendar sync sub-tasks in progress (T-009-e-a done, T-009-e-b/c/d pending). Recurring events pending T-009-f. |
| `T-009-a` | Calendar month grid renderer + navigation | `DONE` | Month view with prev/next/today buttons. |
| `T-009-b` | Calendar event CRUD modal | `DONE` | Add/edit/delete events with title/time/description/category. |
| `T-009-c` | Calendar localStorage persistence | `DONE` | Events load/save to `ncc-calendar-events`. |
| `T-009-d` | Calendar week/day views | `DONE` | Month/week/day switchable. Responsive. Events clickable. |
| `T-009-e` | **Google Calendar sync** — OAuth2 + API integration, settings panel auth, auto/manual sync, status indicator | `DONE` | T-009-e-a/b/c/d all complete. Engine fetches primary calendar via API key, merges with local events (gcalId tracking), updates dirty fields only. Auto-sync loop with configurable interval. Toolbar dot shows none/linked/syncing/synced/error. |
| `T-009-e-a` | Google Calendar sync — Settings panel UI for auth, toggle, manual sync button, status display | `DONE` | Settings section with API key / OAuth fields, auto-sync toggle, manual sync trigger, status indicator (linked/synced/error). Stores config in ncc-settings.calendarSync. Toolbar dot reflects status. |
| `T-009-e-b` | Google Calendar sync — OAuth2 + API client wiring | `DONE` | API key + OAuth fields in Settings. Triggers `calendarSyncChanged` custom event. Sync engine moved to gcal-sync.js. |
| `T-009-e-c` | Google Calendar sync — Sync engine (read events, merge with localStorage) | `DONE` | Fetch events list, merge into ncc-calendar-events with gcalId field, handle conflicts. Syncing badge added. |
| `T-009-e-d` | Google Calendar sync — Auto-sync background loop + Calendar header status dot | `DONE` | Poll every N minutes when enabled. Show green/amber/red dot in calendar toolbar. Interval change reboots timer. |
| `T-009-f` | Calendar recurring events engine | `DONE` | Daily/weekly/monthly/yearly recurrence. Events rendered with ↻ badge. Occurrences generated on-the-fly for month/week/day views. No hard end-date or count-limit yet. |
| `T-010` | Notes app — rich text or markdown editor, folders/tags, search | `DONE` | Plain-text editor with CRUD, auto-save, search, and sidebar list. localStorage persistence. Markdown rendering + folders/tags deferred. |
| `T-011` | To-Do app — lists, priorities, due dates, recurring tasks, drag-and-drop | `DONE` | CRUD, priorities, due dates, filters (all/active/completed), clear completed, localStorage persistence, reactive badge count. Recurring + drag-and-drop deferred. |
| `T-012` | Hermes API bridge — real chat backend integration | `PENDING` | Research how to pipe messages to/from Hermes. |
| `T-013` | Data persistence layer — migrate from `localStorage` to a real DB (SQLite/JSON file on server) | `PENDING` | Required before multi-device sync. |
|| `T-014` | **Opt-in Auth System** — no login required by default. Optional per-app PIN lock (Calendar, Notes, To-Do). Configured in IT Hub. All data stays local. | `DONE` | **User directive.** Default = no auth, site loads immediately on open. IT Hub shows "Auth: Off" with gray badge. User can enable a simple 4–6 digit PIN. Frontend overlay (T-014-b), settings integration, and IT Hub card (T-014-c) complete. Server endpoints: status, register, verify, remove. All subtasks done. |
|| `T-014-a` | Server-side PIN hash endpoint — `GET /api/auth/status`, `POST /api/auth/register` (set PIN via PBKDF2+HMAC+salt), `POST /api/auth/verify` | `DONE` | Stores hashed PIN + salt in `~/.hermes/nexus-auth.json`. Returns `{pinEnabled:boolean}` and `{ok:boolean}` for verify. Python `hashlib` only, no bcrypt dep needed. PIN is 4-6 digits; PBKDF2 500k rounds. POST handled in do_POST and _api_handler. |
||| `T-014-b` | Frontend PIN overlay + settings integration | `DONE` | Unlock overlay for locked apps (Calendar, Notes, To-Do). Settings section "Security" with PIN create/confirm, per-app checkboxes, status badge. |
||| `T-014-c` | IT Hub Auth card update — show real PIN status instead of "Not implemented" | `DONE` | `it-auth` card displays "Auth: Off/On" and lock status per app. Server `/api/auth/remove` added. Settings disable flow uses new endpoint. |
| `T-015` | Offline mode — service worker caches assets + data | `DONE` | Indicator in header, stale-while-revalidate caching, offline-aware Google Calendar sync pause, data queue for background sync. |
| `T-015-a` | Enhanced service worker with stale-while-revalidate for assets and offline indicator in header bar | `DONE` | SW version bumped to nexus-v2, caches all app CSS/JS/assets. |

### 🟢 LOW (Backlog / Nice to Have)
| ID | Task | Status | Notes |
|----|------|--------|-------|
| `T-016` | Weather widget app | `DONE` | Open-Meteo free API: current conditions + 5-day forecast, city search via geocoding API, localStorage persistence, responsive layout with CSS custom properties. |
| `T-017` | Spotify / music player widget | `PENDING` | Mini player with controls. |
| `T-018` | RSS feed reader / news aggregator | `PENDING` | For staying updated. |
| `T-019` | Finance tracker app | `PENDING` | Simple expense logging. |
| `T-020` | AI task suggester — agent analyzes usage patterns and suggests new apps/features | `PENDING` | Meta-agent feature. |

### 🟣 NEW FEATURES (Just Added — User Requested)
| ID | Task | Status | Notes |
|----|------|--------|-------|
| `T-021` | **Feedback AI** — in-app feedback form that generates structured whiteboard tasks, asks clarifying questions, and stores submissions | `DONE` | All subtasks complete. |
|| `T-021-a` | Feedback form UI + localStorage + history list | `DONE` | Form with type, title, desc, priority. Renders user's past submissions. |
|| `T-021-b` | Smart question engine — AI asks clarifying questions before accepting submission | `DONE` | Type-based question sets (feature/bug/improvement/theme/other). 2–3 questions each with contextual placeholders. Multi-step UI with Back/Next/Skip/Review. Answers stored per feedback entry. |
||| `T-021-c` | Whiteboard task generator — convert feedback entries into WHITEBOARD.md format for agent ingestion | `DONE` | Button on each submission generates formatted markdown with task ID, priority badge, status, and clarifying answers. Copyable to clipboard. |
| `T-022` | **Agent Stats Panel** — in Settings: live agent metrics (tasks done, bugs fixed, commits, wake cycles, upcoming tasks, last/next run) | `DONE` | Live indicator dot in header with breathe animation, server-side `/api/agent/status` + `/api/agent/heartbeat` endpoints, and `/api/agent/notify` + `/api/agent/notifications` for build notifications. `liveAgentStatus()` JS helper ready for heartbeat wiring. |
| `T-023` | **Jarvis Theme** — Iron Man HUD aesthetic, electric arc-blue, holographic glow, HUD grid lines | `DONE` | **User directive.** Theme file `jarvis.css` added to `public/css/themes/`. Electric arc-blue `#39d0f2`, scanline overlay, glowing accents, HUD grid background. |
||| `T-024` | **Phone Bridge App** — ADB Android integration: send/read SMS, connection status, battery/signal telemetry | `DONE` | **User directive.** Agent controls connected Android phone via ADB. Dashboard shows phone status. Supports one-way message log + two-way compose. Thread view with chat bubbles. All sub-tasks complete (a–f). |
|| `T-024-a` | ADB device detector script — detect USB/wireless ADB, auto-pair if needed | `DONE` | Python script `scripts/adb-bridge.py` detects device, polls battery/signal, reads SMS inbox, sends SMS. Writes state to `~/.hermes/nexus-adb-state.json` for dashboard polling. |
|| `T-024-b` | Nexus server ADB API — extend nexus-server.py with `/api/adb/status`, `/api/adb/sms/read`, `/api/adb/sms/send` | `DONE` | Zero build-step backend. CORS enabled. Status reads state file; read returns cached inbox; send shells out to adb-bridge.py. |
|| `T-024-c` | Dashboard Phone Bridge app UI — connection status indicator, battery/phone info panel | `DONE` | Green/amber/red dot for ADB connection. Battery bar, signal dBm. Compose tab with To + body + Send. Inbox tab with thread grouping and sent-log merging. Thread tab with chat bubbles. Responsive mobile-first. |
|| `T-024-d` | SMS Inbox viewer — one-way message history pulled from phone via ADB | `DONE` | Thread grouping, contact display name, timestamps newest-first, cached inbox fallback. |
|| `T-024-e` | SMS Compose & Send — two-way messaging from dashboard to phone number | `DONE` | Compose tab + thread reply box. Character counter. Sending state with disabled button. Clears input on success. Toast feedback. |
|| `T-024-f` | Per-contact conversation thread view — chat-bubble style thread | `DONE` | Bubble UI for in/out messages, timestamps, scrollable thread container, inline reply textarea, keyboard accessible, mobile-first. |
| `T-025` | **Smart PDF Editor** — upload PDF + natural language instruction, agent loads PDF skills to edit text/merge pages/replace content/export | `PENDING` | **User directive.** User uploads PDF and types instruction (e.g. "change title to X", "merge with doc2.pdf"). Dashboard triggers agent which loads `nano-pdf` or `ocr-and-documents` skill, performs edit, returns download link. |
| `T-025-a` | PDF upload dropzone + UI — accept `.pdf` via drag/drop, show thumbnail, list of uploaded PDFs in localStorage | `PENDING` | Uses `<input type=file accept=.pdf>` + `FileReader` for preview. Stores metadata in `ncc-pdf-library`. |
| `T-025-b` | Natural language instruction parser — parse user text into structured edit command (replace text, insert page, merge, extract pages, OCR) | `PENDING` | Simple keyword-match → command object. Falls back to "generic edit" if unclear. |
| `T-025-c` | Agent PDF execution bridge — nexus-server.py endpoint `/api/pdf/edit` receives `{pdfId, instruction}`, shells out to Python script that loads `nano-pdf` / `pymupdf` to edit | `PENDING` | Python backend extension. Agent script checks for `uv` package manager to install `pymupdf` if missing. |
| `T-025-d` | PDF preview & download — render edited PDF in `<iframe>` or `<canvas>`, offer download, keep version history | `PENDING` | Versioned edits stored on server disk. User can rollback to previous version. |
|| `T-026` | **Mini Games Arcade** — dedicated "Arcade" app tab with collection of quick casual games | `IN_PROGRESS` | **User directive.** Arcade cabinet aesthetic. Each game is a self-contained canvas-based module. Keep-me-busy mode. |
|| T-026-a | Arcade app shell + game launcher grid — 3x3 (or scrollable) grid of game cards with high scores | `DONE` | App card added to dashboard, nav link, CSS/JS modules. 7 games listed (Snake, Pong, Tetromino, Minesweeper, 2048, Typing, Reaction). All show "Coming Soon" placeholder. High score storage API ready (`saveHighScore`, `arcadeReportScore`). |
|| T-026-b | Game: Snake — classic snake, touch + keyboard controls, score + high score | `DONE` | Canvas-based. Speed increases with score. Particle effects on eat. Mobile swipe controls. Escape to exit. |
||| T-026-c | Game: Pong — vs CPU, difficulty levels, score tracking | `DONE` | Canvas-based. Touch drag for paddle on mobile. Keyboard arrows/W/S. First to 7 wins. Particle effects on paddle hits. Auto difficulty ramp. |
|| `T-026-d` | Game: Tetromino (Tetris clone) — 7-bag randomizer, hold piece, next preview, line clear scoring | `DONE` | Canvas-based. Touch controls: tap to rotate, swipe to move/drop. 7-bag, hold, ghost piece, level/speed scaling, particle effects. |
|| `T-026-e` | Game: Minesweeper — classic, 3 difficulties, flag mode, chord reveal, timer | `PENDING` | DOM-based grid. Right-click / long-press to flag. |
| `T-026-f` | Game: 2048 — swipe/arrow to merge tiles, undo once per game, score + best | `PENDING` | DOM-based or canvas. Smooth slide animation via CSS transform. |
| `T-026-g` | Game: Typing Speed Test — WPM / accuracy / time attack modes | `PENDING` | Text corpus from quotes API or hardcoded list. Real-time WPM calculation. |
| `T-026-h` | Game: Reaction Time Tester — click when green, measure ms, average of 5 | `PENDING` | Simple state machine. Anti-cheat: detect early clicks. |
| `T-026-i` | Arcade high score leaderboard — global per-game scores in `localStorage` | `PENDING` | Simple array sort. Show top 10 with dates. |
| `T-027` | **Work Simulator** — "look busy" mode: fake IDE, fake terminal scrolling, fake build notifications, fake Slack messages, all designed to make it look like you're deep in work | `PENDING` | **User directive.** Paranoia/theater mode for open offices / shoulder surfers. |
| `T-027-a` | Work Simulator launcher + mode picker — choose from VS Code, JetBrains, Terminal, Dashboard, Spreadsheet, Slack, or Auto-Rotate | `PENDING` | Mode selection buttons. Quick toggle from dashboard header or Settings. Full-screen takeover with zero browser chrome visible. |
| `T-027-b` | VS Code / JetBrains clone mode — syntax-highlighted code auto-types real production code with realistic file trees, git status markers, build success flashes, minimap, and problem panels | `PENDING` | 5 pre-built projects (nexus-command-center, meridian-analytics, aegis-platform, etc). File names look real. Code is real-ish. Contextual pauses when mouse moves. |
| `T-027-c` | Terminal Only mode — full-screen realistic terminal streaming docker, terraform, cargo, pytest, kubectl with real ANSI progress bars and package names | `PENDING` | 8 pre-built sessions with realistic timing. Real file paths. Green checkmarks. Occasional warnings. |
| `T-027-d` | Real Dashboard mode — Grafana/Metabase-style layout with fluctuating SaaS metrics, deploy pipelines, P95 latency, alert panels, auto-refreshing charts | `PENDING` | 6 panel layouts. Metrics wobble ±2%. "High CPU on prod-api-03" amber alerts. Build passed toasts. |
| `T-027-e` | Real Slack / Teams mode — realistic channel list, conversation snippets, CI bot posts, emoji reactions, typing indicator, file upload thumbnails | `PENDING` | 5 channels (#alerts, #deployments, #frontend, #backend, #general). Realistic conversation flow. |
| `T-027-f` | Boss Key — instant `Ctrl+B` / `Ctrl+~` swap to Real Spreadsheet with formulas, conditional formatting, Q3 revenue data, pivot tables | `PENDING` | Zero-animation instant swap. Looks like you switched to Excel/Google Sheets naturally. Real formulas in formula bar. |
| `T-027-g` | Content engine + realism subsystem — pre-baked realistic code snippets, terminal logs, dashboard JSON feeds, Slack chats, spreadsheet data loaded from `public/assets/work-sim/` | `PENDING` | Content packs: 5 projects, 8 terminal sessions, 6 dashboard layouts, 5 Slack channels, 3 spreadsheets. Total ~3,000 lines of realistic pre-baked content. |
| `T-028` | **Additional Mini Games Backlog** — collection of smaller game ideas for future Arcade expansion | `PENDING` | **User directive.** More keep-me-busy games. |
| `T-028-a` | Game: Breakout — paddle + bricks, power-ups, levels | `PENDING` | Canvas-based. |
| `T-028-b` | Game: Space Shooter — horizontal scroller, enemies, bullets | `PENDING` | Canvas-based. |
| `T-028-c` | Game: Memory Match — card flip matching, timer, moves counter | `PENDING` | DOM-based grid. |
| `T-028-d` | Game: Word Scramble — unscramble words against timer | `PENDING` | Word list from API or hardcoded. |
| `T-028-e` | Game: Trivia Quiz — multiple choice, categories, streak counter | `PENDING` | Question bank in JSON. |
|| `T-028-f` | Game: Sudoku — generator + solver hint, 4 difficulties | `PENDING` | DOM grid. Highlight conflicts. |

### 🔵 IT HUB / SYSTEM STATUS (User Requested — Agent Directive)
| ID | Task | Status | Notes |
|----|------|--------|-------|
|| `T-029` | **IT Hub app** — new dashboard page that shows live system status, health, and connection state of all Nexus services | `DONE` | **User directive.** Single-pane-of-glass for IT/sysadmin overview. Midnight Hacker aesthetic. |
|| `T-029-a` | IT Hub shell + route + nav icon — register new app in APP_REGISTRY, create `public/apps/it-hub.html` + `public/js/apps/it-hub.js`, wire router | `DONE` | Icon: 🖥️. Route: `#it-hub` (used via backup view body). Grid layout with responsive cards. |
|| `T-029-b` | Login/Auth status card — show current auth state (logged in / guest), display username/role, session expiry countdown, logout button | `DONE` | Reads from `ncc-settings.auth`. Shows "Not implemented" with gray badge until auth system lands. |
|| `T-029-c` | System health telemetry card — CPU usage %, RAM usage %, disk usage %, uptime, load average. Live numbers updated every 5s via `/api/system/health` | `DONE` | Backend endpoint in `nexus-server.py`. Uses `psutil` if available. JSON response. |
|| `T-029-d` | Tailscale / network status card — show tailnet IP, tailscale connection state (up/down), advertised routes, connected peers count, MagicDNS status | `DONE` | Endpoint `/api/system/network` added to `nexus-server.py`. Shells out to `tailscale status --json`. Handles "not installed" gracefully. |
|| `T-029-e` | Google Calendar API status card — show GCal sync state (linked/unlinked), last sync timestamp, next auto-sync countdown, event count synced, OAuth token expiry | `PENDING` | Reads from `ncc-settings.calendarSync`. Green/amber/red dot based on `lastSyncTime` age. |
|| `T-029-f` | Server / process status card — show `nexus-server.py` PID, port, uptime, last git push timestamp, git branch, uncommitted changes count, last commit hash | `DONE` | Endpoint `/api/server/status` already present and working. |
|| `T-029-g` | Debug & logs card — display last 20 lines of `~/.hermes/logs/errors.log`, `nexus-server.py` stdout path, Hermes gateway status (running/stopped), cron job status | `DONE` | Endpoint `/api/system/logs` already present and working. Color-coded ERROR/WARNING/INFO. |
|| `T-029-h` | Service dependency matrix — grid showing: PostgreSQL? Redis? Tailscale? Google API? GitHub Push? HTTPS? DNS? Each cell: green ✓ / red ✗ / amber ⚠ with hover tooltip explaining check | `DONE` | Endpoint `/api/system/deps` already present and working. Probes: TCP connect, HTTP ping, file existence. |
|| `T-029-i` | IT Hub theme styling — dark ``Midnight Hacker`` aesthetic: monospace fonts, neon green accents, amber warnings, red alerts, terminal-style panels with `┌─` borders, scanline overlay, blinking cursors on live metrics | `PENDING` | Uses CSS custom properties. Terminal scanline overlay added. Borders deferred. Mobile-first grid: 1-col → 2-col → 3-col. |
|| `T-029-j` | IT Hub settings integration — add toggle to Settings for "Show IT Hub in main grid", default `false` until stable. Add "Refresh All" button and per-card manual refresh. | `DONE` | Toggle added to Settings panel (`it-hub-visible`). Refresh All + per-card refresh + Copy Status Report buttons added to UI. |
|| `T-029-k` | IT Hub export / alert — "Copy status report" button that generates a markdown diagnostic summary for pasting into chat or GitHub issues | `DONE` | Generates `| Card | Key | Value |` markdown table from live card rows. Copies to clipboard. Falls back to textarea selection. |

**Backend API spec for `nexus-server.py`:**
- `GET /api/system/health` → `{cpu_percent, ram_percent, disk_percent, uptime_seconds, load_avg_1m}`
- `GET /api/system/network` → `{tailscale_ip, tailscale_status, peers_count, magic_dns, error?}`
- `GET /api/server/status` → `{pid, port, uptime_seconds, git_branch, last_commit, uncommitted_count, last_push_time}`
- `GET /api/system/logs` → `{errors_log_tail: [...], gateway_running: bool, cron_enabled: bool}`
- `GET /api/system/deps` → `{services: [{name, status, message}]}`

**Notes:** All endpoints must return CORS headers for dashboard fetch. Use `json.dumps()` with `default=str` for datetime objects. Cache heavy checks (psutil, tailscale) for 5-10 seconds.

### 🔒 BACKUP & RECOVERY (T-030)
| ID | Task | Status | Notes |
|----|------|--------|-------|
|| `T-030` | **Backup & Recovery** — server-side backup engine, dashboard UI, USB detection, encrypted archives, cloud vault config | `DONE` | All sub-tasks complete T-030-a through T-030-f. Health auto-check badge (green/amber/red) lives in IT Hub card. |
|| `T-030-a` | Backup endpoints wired into `nexus-server.py` — `/api/backup/usb` + `/api/backup/run` | `DONE` | USB scanning via `lsblk` fallback to `/media`/`/mnt`. Run endpoint accepts JSON payload, writes to `~/.hermes/backups`, optionally GPG-encrypts with passphrase, copies to USB target. |
|| `T-030-b` | Backup dashboard UI — `backup.js` card, view, status panel, USB list, cloud config form, history | `DONE` | Self-contained module. Renders card, view, polling. localStorage history + server-side file history. |
|| `T-030-c` | Fix critical `nexus-server.py` structural bug — `_api_backup` was inside class scope causing 501/404 on all backup endpoints | `DONE` | Extracted `_api_backup` to top-level function before `SPAHandler`. Verified `/api/backup/usb` and `/api/backup/run` respond correctly. |
|| `T-030-d` | Backup history endpoint — `GET /api/backup/history` returns list of archived backup files from server disk with metadata (filename, size, created, encrypted) | `DONE` | Lists `nexus-backup-*` files from `~/.hermes/backups`, sorted newest first. Includes download button in UI. |
|| `T-030-e` | Restore endpoint — `POST /api/backup/restore` accepts a backup filename, decrypts if needed, merges data back into browser via download prompt or direct localStorage injection | `DONE` | User picks backup from history, confirms destructive merge, gets success toast. UI: restore button per entry, passphrase modal for encrypted backups, merge preview (Add Only vs Full Replace). Endpoint: decrypt with `gpg --batch --passphrase-fd 0 --decrypt`. Security: path traversal blocked. |
|| `T-030-f` | Backup health auto-check — dashboard badge turns amber if no backup in 7 days, red if > 30 days | `DONE` | Reads backup log `latest` age and updates `#backup-health-status` to green/amber/red. Badge dot in IT Hub card turns matching color. |
| `T-031` | **Cloud Vault** — encrypted cloud sync via rclone/rsync/S3 | `PENDING` | **User directive.** After T-030 is stable. UI config already present. Actual upload/download deferred. |
| `T-032` | **Email Agent / Inbox App** — Gmail integration + AI-powered smart inbox sorting, priority triage, and email agent cron job | `PENDING` | **User directive.** New dashboard app for email. Starts dimmed/welcome screen. Two modes: basic inbox (Gmail API read/send) and AI agent mode (auto-sorts, prioritizes, drafts replies, flags action items). |
|| `T-032-a` | Gmail API OAuth2 integration — settings panel for Gmail API key / OAuth, scope `gmail.readonly` + `gmail.send`, token persistence in `ncc-settings.gmail` | `PENDING` | Reuse Google Calendar auth pattern. Trigger `gmailAuthChanged` custom event. Store token expiry. |
|| `T-032-b` | Email inbox UI shell — dimmed/welcome overlay on first load, sidebar with folders (Inbox, Sent, Drafts, Starred, Trash), email list view, thread/compose pane | `PENDING` | App shell in `public/apps/email.html` + `public/js/apps/email.js`. Register in APP_REGISTRY. Responsive: list+preview on desktop, list→detail on mobile. |
|| `T-032-c` | Email read / fetch engine — `GET /api/email/threads` and `GET /api/email/:id` endpoints via nexus-server.py, fetch from Gmail API, cache in localStorage with timestamp | `PENDING` | Pagination support (maxResults). Decodes base64 MIME bodies. Caches thread list to reduce API calls. |
|| `T-032-d` | Email compose & send — rich text composer with To/CC/BCC, subject, body, attachments (base64 upload). `POST /api/email/send` endpoint | `PENDING` | Uses Gmail API `users.messages.send`. Draft auto-save to localStorage. Send progress indicator. |
|| `T-032-e` | **AI Email Agent toggle** — settings switch "Enable Email Agent". When ON, spawns a cron job (via `cronjob` tool or server-side loop) that polls Gmail every N minutes, classifies emails by priority/urgency, generates action-item summaries, auto-drafts replies for approval | `PENDING` | Agent runs server-side Python script. Categories: Urgent (reply needed < 2hrs), Action Required (reply needed < 24hrs), FYI (read when convenient), Spam/Ignore. Stores classification in `ncc-email-agent` localStorage. |
|| `T-032-f` | AI Email Agent UI — smart inbox view with color-coded priority badges (red Urgent, amber Action, blue FYI), auto-drafted reply preview panel, one-click approve/send, "Not Sick? Call off work? I got you" persona examples | `PENDING` | Inline in email app. Shows AI-generated summary per thread: "Boss asked for status report — draft ready". One-tap to send or edit. |
|| `T-032-g` | Email Agent cron job wiring — server-side script `email-agent.py` that loads `gmail` skill if needed, polls Gmail, runs classification via local LLM or rules engine, writes results to disk for dashboard pickup | `PENDING` | Script runs independent of server. Logs to `~/.hermes/logs/email-agent.log`. Agent status exposed via `/api/email/agent/status`. |
|| `T-032-h` | Welcome / start screen — on first app launch, dimmed overlay with "Welcome to your Inbox" + name prompt + START button. No emails visible until START is pressed. | `PENDING` | Fade-in animation. Name stored in `ncc-settings.userName` for future greetings. |
|| `T-033` | **Welcome Rebrand — Cinematic Onboarding** — complete replacement of existing welcome overlay with song-driven, cinematic **2-minute** intro experience | `IN_PROGRESS` | Core implementation complete in `welcome.js` + `welcome.css`. All 4 phases functional: name prompt, beat-reactive text, showcase montage, landing fade-out. Needs live testing and polish. |
||| `T-033-a` | Song preloading & verification | `DONE` | `welcome.js` loads audio, waits for `canplaythrough`, START button disabled until ready, 5s fallback timeout. |
||| `T-033-b` | Phase 1 — name prompt with glowing START button | `DONE` | Dark overlay `#020202`, vignette, centered input, arc-blue glow focus state, ENTER key support. |
||| `T-033-c` | Phase 2 — beat-reactive text sequence (0:00–0:22) | `DONE` | `AnalyserNode` bass detection (bins 0–5, threshold 180). CSS `beatPulse` animation on active text. Screen flash + particle burst per beat. Fallback to timed beats if Web Audio unavailable. |
||| `T-033-d` | Phase 3 — feature showcase montage (0:22–1:45) | `DONE` | 10 showcase beats with icon + copy, timed fly-in/out via `requestAnimationFrame`. Micro-jitter `scale(1.0 → 1.02)` on beat hits. Pure DOM choreography, no video. |
||| `T-033-e` | Phase 3 copy scripting | `DONE` | JSON-driven `SHOWCASE_BEATS` array in `welcome.js`. Agent can edit copy/timing without touching DOM logic. |
||| `T-033-f` | Phase 4 — landing (1:45–2:00) | `DONE` | 15s audio fade-out via `audio.volume` ramp. Dashboard fades in with 1.5s opacity transition. "Welcome back, {name}" if name entered. `ncc-welcome-shown` flag set. |
|||| `T-033-g` | Audio sync engine | `DONE` | `requestAnimationFrame` loop tracks `audio.currentTime` against `PHASE_THRESHOLDS` (0, 22, 105, 120). `AnalyserNode` beat detection runs independently. `prefers-reduced-motion` skips entire intro. |
||| `T-035` | **Nexus logo → Home button** — make the Nexus button/logo in the header clickable, acting as a global "go home" action that returns to the main dashboard grid | `DONE` | Click → `location.hash = 'dashboard'`. Keyboard `Enter`/`Space` supported. Brand styled `cursor:pointer` + hover bg + focus ring. |
||| `T-036` | **Stocks & Crypto view + Paper Trading** — new Finance app: stocks and crypto price tracking (live or API-based) with a built-in paper-trading simulator, portfolio, order history | `IN_PROGRESS` | **User directive.** New dashboard app. Live prices via free API (Yahoo Finance + CoinGecko). Paper trading: virtual balance, buy/sell orders, P&L, transaction log. Charts optional (deferred). Sub-tasks: API integration, portfolio engine, order modal, history. |
||||| `T-036-a` | Stocks & Crypto shell — register new app, card, view HTML + JS, nav icon | `DONE` | App shell in `public/apps/finance.html` + `public/js/apps/finance.js`. Responsive table/grid layout. Tab switch: Stocks / Crypto / Portfolio / Orders. |
||||| `T-036-b` | Live price fetch engine — free API for stock/crypto quotes, cache in localStorage, poll interval configurable in Settings | `DONE` | Endpoint `/api/finance/prices` in `nexus-server.py`. Yahoo Finance for stocks, CoinGecko for crypto. Server-side 60s cache. Frontend `ncc-finance-prices` localStorage cache & auto-poll with configurable interval (1/5/15/30 min). Settings UI added. Graceful offline fallback to demo prices. |
|||| `T-036-c` | Paper-trading engine — virtual $100k balance, buy/sell with quantity/price, deduct/add balance, update holdings, compute unrealized P&L | `DONE` | Embedded in `finance.js`. Store `ncc-paper-portfolio` in localStorage. Validate balance before buy. Sell only if held. |
|||| `T-036-d` | Order history + transaction log — table of completed orders with timestamp, ticker, side, quantity, price, total | `DONE` | Embedded in `finance.js`. Filterable by ticker and date range. CSV export deferred. |
||| `T-037` | **Settings icon relocation — move into hamburger dropdown, remove top-right button** — the settings gear icon currently on the top right should become its own app, but only visible inside the top-left 3-line hamburger menu dropdown list | `DONE` | Removed `#header-settings-btn` from header. Added `nav-settings-link` button in nav drawer (below Arcade). CSS added for `button.nav-link` resets + `button.nav-link:focus-visible`. Settings opens through shared `initSettings()` close trap (fallback focus → hamburger). |
|| `T-038` | **Logic bug sweep** — agent-wide audit pass: review all JS modules for common logic bugs, race conditions, memory leaks, unhandled edge cases, and `localStorage` quota issues | `IN_PROGRESS` | **User directive.** Priority after UI relocations. Check: event listener cleanup on app switch, `NaN` guards on numeric inputs, `try/catch` around `JSON.parse`, `localStorage` quota exceeded handling, missing `await` on async flows, duplicate ID generation in CRUD, off-by-one in calendar loops, canvas `requestAnimationFrame` leaks in Arcade games. Document findings in BUG TRACKER. Sub-tasks: T-038-a (calendar), T-038-b (notes), T-038-c (phone-bridge), T-038-d (auth), T-038-e (finance). |
|| `T-038-a` | Calendar — fix monthly recurrence infinite loop when day overflows (e.g. Jan 31 → Feb has no 31st) | `DONE` | `getOccurrences` now computes next month deterministically with `setFullYear` + clamp to daysInMonth. Infinite loop eliminated. |
|| `T-038-b` | Notes — fix `renderList(query)` crash when `query` is undefined | `DONE` | Added default parameter `query = ''` to `renderList`. Prevents `undefined.toLowerCase()` TypeError. |
|| `T-038-c` | Phone Bridge — fix chat bubble direction bug where all received messages appear as "out" | `DONE` | `isOut` was `m.type === 'sent' || m.to`, but `m.to` exists on both sent and received messages. Changed to `m.type === 'sent'` only. |
|| `T-038-d` | Auth — fix fail-open behavior when server is unreachable; add PIN overlay focus trap for a11y | `DONE` | `ensureAuthEnabled` now detects offline via `.catch(() => ({offline:true}))` and returns `true` (fail-open). `showPinOverlay` gains `role="dialog"`, `aria-modal`, focus-trap via Tab key, and `aria-live` error region. |
|| `T-038-e` | Finance — fix NaN leak from `getChange()` random fallback; add `aria-label` to change badges | `DONE` | `getChange()` can return `NaN` if `Math.random()` result isn't properly bounded. Added `Number.isNaN()` guard in render. Added `aria-label` to change span for screen readers. |

---

## 🔍 BUG TRACKER

|| ID | Bug | Severity | Found | Status | Fix Notes |
||----|-----|----------|-------|--------|-----------|
|| B-001 | Calendar `getOccurrences` monthly recurrence infinite loop when master date day > days in next month (e.g. Jan 31) | HIGH | 2026-05-09 | FIXED in T-038-a | `setMonth()` caused overflow/rollback → loop never advanced. Fixed with deterministic `setFullYear(year, month, min(day, daysInMonth))`. |
|| B-002 | Notes `renderList(query)` crashes with `TypeError: undefined.toLowerCase()` when called without argument | HIGH | 2026-05-09 | FIXED in T-038-b | `query` parameter had no default. Added `query = ''`. |
|| B-003 | Calendar event ID collisions possible on rapid successive `addEvent` calls within same millisecond | MEDIUM | 2026-05-09 | FIXED in T-038-a | `generateId()` used `Date.now()` + 5-char random. Extended random suffix to 7 chars for better entropy. |
|| B-004 | Finance `getChange()` returns `NaN` when cache miss falls through to random fallback and `Math.random()` edge-case produces invalid value | MEDIUM | 2026-05-09 | FIXED in T-038-e | Added `Number.isNaN(change)` guard in `renderWatchlist`. Also added `aria-label` to change span. |
|| B-005 | Auth `ensureAuthEnabled` blocks users entirely when server is down because `.catch()` resolves to `{pinEnabled:false}` without distinguishing offline vs truly disabled | HIGH | 2026-05-09 | FIXED in T-038-d | Added `offline: true` marker in catch fallback; returns `true` (fail-open) when offline. |
|| B-006 | Phone Bridge SMS thread view marks all messages as "out" because `isOut = m.type === 'sent' || m.to` — `m.to` exists on inbound SMS too | HIGH | 2026-05-09 | FIXED in T-038-c | Changed to `m.type === 'sent'` only. |
|| B-007 | PIN overlay lacks accessibility: no `role="dialog"`, no focus trap, `aria-live` missing on error region | MEDIUM | 2026-05-09 | FIXED in T-038-d | Added `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Tab focus trap, and `aria-live="polite"` on error. |
|| B-008 | Phone Bridge `initPhoneBridge` leaks `setInterval` timer because `timer` variable is local to function and can be overwritten on re-init without clearing previous interval | MEDIUM | 2026-05-09 | FIXED in T-038-c | Replaced local `timer` with `window.__phonePollTimer`, clearing previous interval before starting new one. |

**Agent Rule:** After every code change, visually and logically check for:
- Console errors (open DevTools → Console)
- Responsive layout breaks on 375px (phone) and 1920px (desktop)
- `localStorage` quota exceeded (max ~5MB)
- Memory leaks (event listeners not cleaned up)
- Accessibility failures (missing aria-labels, keyboard traps, color contrast)
- Theme switching glitches (CSS variables not propagating, flashes of unstyled content)

---

## 💡 MISSING FEATURES / IDEAS (Auto-Generated by Agent)

| ID | Idea | Source | Priority | Rationale |
|----|------|--------|----------|-----------|
| `I-001` | Keyboard shortcuts (e.g. `Cmd+K` command palette, `/` to focus search) | Agent initiative | `HIGH` | Power-user essential. Reduces friction massively. |
| `I-002` | Dark/light mode toggle per theme | Agent initiative | `MEDIUM` | Every modern app has this. Some themes should have variants. |
| `I-003` | Backup/export all user data as JSON | Agent initiative | `HIGH` | Data loss prevention. Must exist before real usage. |
| `I-004` | Undo/redo system for notes and to-do edits | Agent initiative | `MEDIUM` | Users expect this. `localStorage` snapshots can work. |
| `I-005` | Notifications / reminders (browser push or in-app toast) | Agent initiative | `HIGH` | Critical for Calendar + To-Do usefulness. |
| `I-006` | Search across all apps (global search bar) | Agent initiative | `HIGH` | Scalability requirement — without it, 10 apps become unnavigable. |
| `I-007` | Auto-save indicators ("Saving..." / "Saved") | Agent initiative | `MEDIUM` | UX polish. Users panic if they don't know state is persisted. |
| `I-008` | Animations reduced preference (accessibility) | Agent initiative | `MEDIUM` | `prefers-reduced-motion` media query. Respect user system settings. |
| `I-009` | Multi-language i18n framework | Agent initiative | `LOW` | Scalability for future. Build strings into a `lang/` directory now. |
| `I-010` | Pin/favorite apps to home grid | Agent initiative | `MEDIUM` | Customization = retention. Easy to implement. |

**Agent Rule:** If you discover a missing feature that is common in modern dashboards (e.g., any app you'd expect in Notion/Obsidian/Linear), add it to this table with rationale. Do NOT silently implement without documenting. If priority is `HIGH`, convert to a Task immediately.

---

## 🧠 AGENT SELF-CHECK PROTOCOL

Every wake cycle, the agent MUST:

1. **Read this file** — parse the Task Board top-to-bottom.
2. **Pick the highest `PENDING` critical task** — only work on ONE task per cycle (focus).
3. **Before coding, check for blockers:**
   - Are prerequisite tasks done? If not, do those first.
   - Is there a bug blocking this task? Fix bugs before features.
4. **After completing work:**
   - Update the task status to `DONE` with a brief note.
   - If you found a bug during implementation, add it to BUG TRACKER.
   - If you thought of a missing feature, add it to MISSING FEATURES.
   - Update CURRENT STATUS metrics.
   - Commit with a descriptive message.
5. **If a task is too large (>~2 hours of work or >200 lines of change):**
   - **BREAK IT INTO SUB-TASKS.**
   - Create `T-XXX-a`, `T-XXX-b`, etc. with clear sub-goals.
   - Update the parent task status to `IN_PROGRESS` and list sub-tasks.
   - Example: `T-009 Calendar app` → `T-009-a Calendar month view`, `T-009-b Calendar event CRUD`, `T-009-c Calendar localStorage sync`.

---

## 📝 AGENT NOTES (Scratchpad)

*Use this space for temporary notes, research findings, reminders, or context you want the next cycle to know.*

- **Tech stack chosen:** Pure HTML/CSS/JS (no build step) + Docker + nginx. This keeps it simple for the agent to modify and for you to understand.
- **Data strategy v1:** All app data in `localStorage` (keyed by app name). When we hit limits or need multi-device, migrate to a server-side JSON/SQLite store.
- **Chat integration research needed:** How to send messages TO Hermes from a web page? Options: Telegram bot API bridge, Hermes webhook, or a local websocket. Marked as `T-012`.
- **Music for welcome:** Use a short royalty-free ambient loop or generate via Web Audio API. Keep it under 5 seconds and respect `prefers-reduced-motion` for audio too.
- **Theme engine design:** One base CSS file with CSS custom properties. Theme files only override variables. This makes adding new themes trivial — just a new variable block.

---

## 🗂️ FILE MAP (For Agent Navigation)

```
nexus-command-center/
├── WHITEBOARD.md          ← YOU ARE HERE (agent command center)
├── PROJECT.md             ← Full product specification (read for context)
├── AGENT_GUIDELINES.md    ← How the agent behaves (read for rules)
├── docker-compose.yml     ← Docker orchestration
├── Dockerfile             ← Container build
├── nginx.conf             ← Static file server config
├── public/
│   ├── index.html         ← Main dashboard
│   ├── manifest.json      ← PWA manifest
│   ├── sw.js              ← Service worker
│   ├── css/
│   │   ├── base.css       ← Core layout + variables
│   │   ├── themes/
│   │   │   ├── professional.css
│   │   │   ├── midnight-hacker.css
│   │   │   ├── sakura-garden.css
│   │   │   ├── space-odyssey.css
│   │   │   ├── retro-arcade.css
│   │   │   └── ocean-breeze.css
│   │   └── apps/          ← Per-app styles
│   ├── js/
│   │   ├── app.js         ← Main init + router
│   │   ├── theme.js       ← Theme engine
│   │   ├── settings.js    ← Settings panel
│   │   ├── welcome.js     ← Onboarding overlay
│   │   ├── chat.js        ← Hermes chat widget
│   │   └── apps/          ← Per-app logic
│   │       ├── calendar.js
│   │       ├── notes.js
│   │       └── todo.js
│   └── assets/
│       ├── icons/         ← App icons + PWA icons
│       └── audio/         ← Welcome music / sfx
```

---

## 🕐 LAST UPDATED

*2026-05-09* — T-032 + T-033 added to task board. Email Agent (Gmail + AI smart inbox) and Welcome Rebrand (cinematic 90s song-driven intro) spec'd with full subtasks. Agent ready to pick up on next cycle.

---

> **To the agent:** This project matters. Build it like you're building your own home. Every detail counts. Make it beautiful, make it fast, make it reliable. When in doubt, prioritize UX and simplicity over cleverness. Good luck. 🤖⚡

---

## 🌍 WHY WE BUILD THIS

**Mission:** We believe in a world where technology works *for* you — not against you. Where AI handles the repetitive, the tedious, and the time-consuming, so you can focus on what actually matters: your family, your passions, your health, your peace of mind.

**Nexus Command Center is not just a dashboard.** It is a personal infrastructure — a digital teammate that wakes up every 15 minutes, reads your whiteboard, and quietly builds the tools you need to live better. No micromanagement. No feature bloat. Just a single source of truth that grows alongside you.

**Core beliefs:**
- **Your time is finite.** Every minute spent fighting with apps, managing calendars, or switching between tabs is a minute stolen from your life. We build so you don't have to.
- **Technology should be invisible.** The best tools are the ones you forget exist — they just work, reliably, in the background, until you need them.
- **Privacy is not a feature.** It is the foundation. Your data lives where you control it. No trackers. No ads. No external dependency hell.
- **Family > everything.** The ultimate goal of productivity is not output — it is freedom. Freedom to be present. Freedom to build memories. Freedom to choose how you spend your days.

**What this means for the agent:**
Every commit you make, every line of code you write, every bug you fix — it all serves one human being's ability to reclaim their time. Build with empathy. Build with urgency. Build like someone's family is waiting for them to log off.

---

> **To the agent:** This project matters. Build it like you're building your own home. Every detail counts. Make it beautiful, make it fast, make it reliable. When in doubt, prioritize UX and simplicity over cleverness. Good luck. 🤖⚡
