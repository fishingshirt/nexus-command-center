# 🤖 AGENT WHITEBOARD — Nexus Command Center

> **This file is the single source of truth for the autonomous agent working on this project.**
> The agent reads this on every wake cycle, executes the top-priority tasks, updates progress here, and goes back to sleep.

---

## 📊 CURRENT STATUS

| Metric | Value |
|--------|-------|
| **Project Phase** | `SCAFFOLDING_COMPLETE` |
| **Last Agent Run** | 2026-05-09 (T-009 month view + CRUD + persistence) |
| **Active Tasks** | 4 (T-009 in progress, T-021-a, T-022, T-023 in progress/done) |
| **Completed Tasks** | 13 (T-001 through T-008, T-009-a/b/c, T-021-a, T-023) |
| **Bugs Found** | 0 |
| **Next Wake** | *(set by cron)* |

**Current Focus:** Build the foundational HTML/CSS/JS scaffold and Docker setup.

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
| `T-009` | Calendar app — full CRUD, month/week/day views, localStorage persistence | `IN_PROGRESS` | Month view + CRUD + persistence done. Week/day view pending T-009-d. |
| `T-009-a` | Calendar month grid renderer + navigation | `DONE` | Month view with prev/next/today buttons. |
| `T-009-b` | Calendar event CRUD modal | `DONE` | Add/edit/delete events with title/time/description/category. |
| `T-009-c` | Calendar localStorage persistence | `DONE` | Events load/save to `ncc-calendar-events`. |
| `T-009-d` | Calendar week/day views | `DONE` | Month/week/day switchable. Responsive. Events clickable. |
| `T-009-e` | **Google Calendar sync** — OAuth2 + API integration, settings panel auth, auto/manual sync, status indicator | `PENDING` | **User directive.** Settings panel needs Google Calendar token/API field. Manual + auto sync checks. Shows 'linked' / 'synced' / 'error' status. Falls back to localStorage if no auth. |
| `T-009-f` | Calendar recurring events engine | `PENDING` | Weekly/monthly/yearly recurrence rules. |
| `T-010` | Notes app — rich text or markdown editor, folders/tags, search | `PENDING` | `localStorage` for now. Consider IndexedDB later. |
| `T-011` | To-Do app — lists, priorities, due dates, recurring tasks, drag-and-drop | `PENDING` | Must sync visually with Calendar. |
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

*2026-05-09* — Initial scaffold complete. Agent can now pick up T-009 and beyond.

---

> **To the agent:** This project matters. Build it like you're building your own home. Every detail counts. Make it beautiful, make it fast, make it reliable. When in doubt, prioritize UX and simplicity over cleverness. Good luck. 🤖⚡
