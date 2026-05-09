# 🤖 AGENT WHITEBOARD — Nexus Command Center

> **This file is the single source of truth for the autonomous agent working on this project.**
> The agent reads this on every wake cycle, executes the top-priority tasks, updates progress here, and goes back to sleep.

---

## 📊 CURRENT STATUS

| Metric | Value |
|--------|-------|
| **Project Phase** | `APP_EXPANSION` |
| **Last Agent Run** | 2026-05-09 (T-009-f Calendar recurring events engine done) |
| **Active Tasks** | 6 (T-009, T-021, T-022 in progress/done + T-024/25/26/27/28 pending) |
| **Completed Tasks** | 18 (T-001 through T-008, T-009-a/b/c/d/e-a/f, T-021-a, T-023, T-010, T-011) |
| **Bugs Found** | 0 |
| **Next Wake** | *(set by cron)* |

|**Current Focus:** Agent can pick up highest-priority pending task: T-009-e-b (Google Calendar OAuth/API wiring) or any new user-requested feature.

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
| `T-009-e` | **Google Calendar sync** — OAuth2 + API integration, settings panel auth, auto/manual sync, status indicator | `IN_PROGRESS` | Broken into sub-tasks below. |
| `T-009-e-a` | Google Calendar sync — Settings panel UI for auth, toggle, manual sync button, status display | `DONE` | Settings section with API key / OAuth fields, auto-sync toggle, manual sync trigger, status indicator (linked/synced/error). Stores config in ncc-settings.calendarSync. Toolbar dot reflects status. |
| `T-009-e-b` | Google Calendar sync — OAuth2 + API client wiring (gapi script injection, token refresh) | `PENDING` | Requires Google Cloud project. Script loads gapi, handles sign-in, stores token. |
| `T-009-e-c` | Google Calendar sync — Sync engine (read events, merge with localStorage) | `PENDING` | Fetch events list, merge into ncc-calendar-events with gcalId field, handle conflicts. |
| `T-009-e-d` | Google Calendar sync — Auto-sync background loop + Calendar header status dot | `PENDING` | Poll every N minutes when enabled. Show green/amber/red dot in calendar toolbar. |
|| `T-009-f` | Calendar recurring events engine | `DONE` | Daily/weekly/monthly/yearly recurrence. Events rendered with ↻ badge. Occurrences generated on-the-fly for month/week/day views. No hard end-date or count-limit yet. |
|| `T-010` | Notes app — rich text or markdown editor, folders/tags, search | `DONE` | Plain-text editor with CRUD, auto-save, search, and sidebar list. localStorage persistence. Markdown rendering + folders/tags deferred. |
|| `T-011` | To-Do app — lists, priorities, due dates, recurring tasks, drag-and-drop | `DONE` | CRUD, priorities, due dates, filters (all/active/completed), clear completed, localStorage persistence, reactive badge count. Recurring + drag-and-drop deferred. |
| `T-012` | Hermes API bridge — real chat backend integration | `PENDING` | Research how to pipe messages to/from Hermes. |
| `T-013` | Data persistence layer — migrate from `localStorage` to a real DB (SQLite/JSON file on server) | `PENDING` | Required before multi-device sync. |
| `T-014` | Auth / user sessions — basic login so data isn't world-readable | `PENDING` | Simple JWT or even just a password hash. |
| `T-015` | Offline mode — service worker caches assets + data | `PENDING` | For phone use without constant connection. |

### 🟢 LOW (Backlog / Nice to Have)
| ID | Task | Status | Notes |
|----|------|--------|-------|
| `T-016` | Weather widget app | `PENDING` | Free API like OpenWeatherMap. |
| `T-017` | Spotify / music player widget | `PENDING` | Mini player with controls. |
| `T-018` | RSS feed reader / news aggregator | `PENDING` | For staying updated. |
| `T-019` | Finance tracker app | `PENDING` | Simple expense logging. |
| `T-020` | AI task suggester — agent analyzes usage patterns and suggests new apps/features | `PENDING` | Meta-agent feature. |

### 🟣 NEW FEATURES (Just Added — User Requested)
| ID | Task | Status | Notes |
|----|------|--------|-------|
| `T-021` | **Feedback AI** — in-app feedback form that generates structured whiteboard tasks, asks clarifying questions, and stores submissions | `IN_PROGRESS` | **User directive.** Feedback form with type selector, priority picker, title, description, and question prompts for missing details. Stores in localStorage and generates agent-readable task cards. |
| `T-021-a` | Feedback form UI + localStorage + history list | `DONE` | Form with type, title, desc, priority. Renders user's past submissions. |
| `T-021-b` | Smart question engine — AI asks clarifying questions before accepting submission | `PENDING` | Based on type & description, auto-prompt: "What problem does it solve?", "Who is it for?", etc. Only finalizes once answered. |
| `T-021-c` | Whiteboard task generator — convert feedback entries into WHITEBOARD.md format for agent ingestion | `PENDING` | Export `ncc-feedback` entries as formatted tasks with IDs and priority. |
| `T-022` | **Agent Stats Panel** — in Settings: live agent metrics (tasks done, bugs fixed, commits, wake cycles, upcoming tasks, last/next run) | `IN_PROGRESS` | **User directive.** Reads from `ncc-settings.agentStats`. Offers "Refresh Whiteboard" button that fetches `WHITEBOARD.md` and parses task board. |
| `T-023` | **Jarvis Theme** — Iron Man HUD aesthetic, electric arc-blue, holographic glow, HUD grid lines | `DONE` | **User directive.** Theme file `jarvis.css` added to `public/css/themes/`. Electric arc-blue `#39d0f2`, scanline overlay, glowing accents, HUD grid background. |
| `T-024` | **Phone Bridge App** — ADB Android integration: send/read SMS, connection status, battery/signal telemetry | `PENDING` | **User directive.** Agent controls connected Android phone via ADB. Dashboard shows phone status. Supports one-way message log + two-way compose. |
| `T-024-a` | ADB device detector script — detect USB/wireless ADB, auto-pair if needed | `PENDING` | Python script run by build agent to verify device and cache state. |
| `T-024-b` | Nexus server ADB API — extend nexus-server.py with `/api/adb/status`, `/api/adb/sms/read`, `/api/adb/sms/send` | `PENDING` | Zero build-step backend: extend existing Python SPA server. CORS enabled for dashboard fetch. |
| `T-024-c` | Dashboard Phone Bridge app UI — connection status indicator, battery/phone info panel | `PENDING` | Green/amber/red dot for ADB connection. Shows battery %, signal bars, last sync. |
| `T-024-d` | SMS Inbox viewer — one-way message history pulled from phone via ADB | `PENDING` | Display SMS threads with contact names, body, timestamp. Sorted newest-first. |
| `T-024-e` | SMS Compose & Send — two-way messaging from dashboard to phone number | `PENDING` | Text input + To: field. Uses `/api/adb/sms/send`. Stores sent messages in local log. |
| `T-024-f` | Per-contact conversation thread view — chat-bubble style thread | `PENDING` | Group messages by phone number into threads. Show outgoing/incoming bubble colors. |
| `T-025` | **Smart PDF Editor** — upload PDF + natural language instruction, agent loads PDF skills to edit text/merge pages/replace content/export | `PENDING` | **User directive.** User uploads PDF and types instruction (e.g. "change title to X", "merge with doc2.pdf"). Dashboard triggers agent which loads `nano-pdf` or `ocr-and-documents` skill, performs edit, returns download link. |
| `T-025-a` | PDF upload dropzone + UI — accept `.pdf` via drag/drop, show thumbnail, list of uploaded PDFs in localStorage | `PENDING` | Uses `<input type=file accept=.pdf>` + `FileReader` for preview. Stores metadata in `ncc-pdf-library`. |
| `T-025-b` | Natural language instruction parser — parse user text into structured edit command (replace text, insert page, merge, extract pages, OCR) | `PENDING` | Simple keyword-match → command object. Falls back to "generic edit" if unclear. |
| `T-025-c` | Agent PDF execution bridge — nexus-server.py endpoint `/api/pdf/edit` receives `{pdfId, instruction}`, shells out to Python script that loads `nano-pdf` / `pymupdf` to edit | `PENDING` | Python backend extension. Agent script checks for `uv` package manager to install `pymupdf` if missing. |
| `T-025-d` | PDF preview & download — render edited PDF in `<iframe>` or `<canvas>`, offer download, keep version history | `PENDING` | Versioned edits stored on server disk. User can rollback to previous version. |
| `T-026` | **Mini Games Arcade** — dedicated "Arcade" app tab with collection of quick casual games | `PENDING` | **User directive.** Arcade cabinet aesthetic. Each game is a self-contained canvas-based module. Keep-me-busy mode. |
| `T-026-a` | Arcade app shell + game launcher grid — 3x3 (or scrollable) grid of game cards with high scores | `PENDING` | Each card shows game icon, best score, play button. Grid responsive. |
| `T-026-b` | Game: Snake — classic snake, touch + keyboard controls, score + high score | `PENDING` | Canvas-based. Speed increases with score. Particle effects on eat. |
| `T-026-c` | Game: Pong — vs CPU, difficulty levels, score tracking | `PENDING` | Canvas-based. Touch drag for paddle on mobile. |
| `T-026-d` | Game: Tetromino (Tetris clone) — 7-bag randomizer, hold piece, next preview, line clear scoring | `PENDING` | Canvas-based. Touch controls: tap to rotate, swipe to move/drop. |
| `T-026-e` | Game: Minesweeper — classic, 3 difficulties, flag mode, chord reveal, timer | `PENDING` | DOM-based grid. Right-click / long-press to flag. |
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
| `T-028-f` | Game: Sudoku — generator + solver hint, 4 difficulties | `PENDING` | DOM grid. Highlight conflicts. |

---

## 🔍 BUG TRACKER

| ID | Bug | Severity | Found | Status | Fix Notes |
|----|-----|----------|-------|--------|-----------|
| *(empty)* | | | | | |

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

*2026-05-09* — T-009-e-a Google Calendar sync settings UI complete.

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
