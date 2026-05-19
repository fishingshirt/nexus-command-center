# 🤖 Nexus Agent Task Board

> **Single source of truth.** The agent reads this first every wake cycle.
> For full details on any task, read the linked file in `tasks/`.


## 📊 Status Snapshot

- **Project phase:** Agent Task System
- **Last updated:** 2026-05-14 17:45 UTC
- **Active tasks:** 1 (1 pending, 0 in-progress, 2 blocked)
- **Completed tasks:** 38+ shown below
- **Agent state:** ACTIVE — wake cycle running every 30min

## 🎯 Active Tasks
| MEDIUM | `T-065` | Calendar Dark Mode Bug | `PENDING` | Auto-generated from feedback |

| Priority | ID | Task | Status | Details |
|----------|----|------|--------|---------|
| MEDIUM | `T-017-a` | Spotify Integration OAuth + playback shell | `BLOCKED` | Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in ~/.hermes/.env |
| MEDIUM | `T-063` | Calendar Service Email Integration | `BLOCKED` | Awaiting user API credentials + calendar permissions | [`tasks/T-063.md`](tasks/T-063.md) |
| LOW | `T-064` | Agent Virtual Office (pixel-art game view) | `PENDING` | User request — do not start yet | [`tasks/T-064.md`](tasks/T-064.md) |


## ✅ Recently Done

| ID | Task |
|----|------|
| `T-040-b` | Widget Grid CSS + add/remove drawer |
| `T-059` | Hermes Chat Bridge Replies Never Arrive |
| `T-020-a` | AI Suggester — JS app module + wiring |
| `T-040-a-1` | Widget Grid core engine + default layout |
| `T-019-c` | Finance tracker server backup API |
| `T-062-a` | Recipe App JS module + wiring |
| `T-062-b` | Recipe App CSS module |
| `T-043-b` | Quick Capture note/event/todo save logic |
| `T-043-a` | Quick Capture FAB + radial menu + modal shell |
| `T-055-b` | Feedback Pipeline dashboard UI + tracker |
| `T-032` | Email Agent / Smart Inbox |
| `T-055-a` | Feedback Pipeline backend queue API |
| `T-031-b` | Cloud Vault CSS module |
| `T-031-a` | Cloud Vault JS app + wiring |
| `T-041` | Global search bar — keyboard /, fuzzy search, grouped results, mobile full-screen, highlight pulse |
| `T-061` | Wishlist App (links, notes, priority, status) |
| `T-044` | World Clock Widget |
| `T-053` | News & Media Hub |
| `T-058` | All themes should support dark mode (default on) |
| `T-057` | Default theme should be dark |
| `T-029` | IT Hub / System health dashboard (backup view integration, status cards, API endpoints, settings toggle) |
| `T-034` | Google Calendar two-way sync audit & fix |
| `T-042` | Unified notifications center |
| `T-045` | Pomodoro timer / focus mode |
| `T-009` | Calendar app (views, CRUD, recurrence, Google sync) |
| `T-010` | Notes app (CRUD, search, auto-save) |
| `T-011` | To-Do app (lists, priorities, recurring, filters) |
| `T-012` | Hermes API bridge (Telegram Bot API relay + dashboard chat polling) |
| `T-014` | Opt-in auth system (PIN overlay, per-app lock) |
| `T-015` | Offline mode + enhanced service worker |
| `T-016` | Weather widget (Open-Meteo, geocoding) |
| `T-021` | Feedback AI (form, questions, whiteboard generator) |
| `T-022` | Agent Stats Panel (live metrics, heartbeat, notifications) |
| `T-023` | Jarvis theme |
| `T-024` | Phone Bridge (ADB detect, SMS read/send, threads) |
| `T-026` | Mini Games Arcade core (Snake, Pong, Tetromino, Minesweeper, 2048, Typing) |
| `T-030` | Backup & Recovery (USB, encrypted archives, restore) |
| `T-033` | Welcome rebrand (cinematic onboarding) |
| `T-035` | Nexus logo home button |
| `T-036` | Stocks & crypto + paper trading |
| `T-037` | Settings icon relocation |
| `T-038` | Logic bug sweep (calendar, notes, phone-bridge, auth, finance) |
| `T-013` | Data persistence layer (all sub-tasks complete: adapter, migration, per-app audit, settings bridge, offline badge + retry queue, integrity guard) |
| `T-056` | Fix Weather app layout centering (hero + forecast off-center) |
| `T-060` | Quality Check Pipeline + Quality Approval Gate — COMPLETE |
| `T-060-a` | QC Auto Gate: syntax & cross-ref validator |
| `T-060-b` | QA Agent Review Checklist & Sign-Off |
| `T-060-c` | Backlog Audit: all legacy files queued |
| `T-060-d` | Dashboard Quality Status Panel (server endpoints, settings UI, CSS, JS) |
| `T-060-e` | Fast-Track & Merge Gate Rules |
| `T-018` | RSS feed reader |
| `T-019-a` | Finance tracker JS app + wiring |
| `T-019-b` | Finance tracker CSS module |
| `T-031-c` | Cloud Vault server API + AES encryption |
| `T-039` | Multi-city weather manager |
| `T-047` | Keyboard shortcuts / hotkey system |
| `T-062-a` | Recipe App JS module + wiring |
| `T-062-b` | Recipe App CSS module |
| `~~`T-051`~~` | ~~Post-completion QA & continuous improvement loop~~ |
| `~~`T-057`~~` | ~~Default theme should be dark~~ |
| `~~`T-058`~~` | ~~All themes should support dark mode (default on)~~ |


## 📝 Agent Notes

- **Tech stack:** Pure HTML/CSS/JS dashboard (no build step) + Python server on local machine.
- **This repo lives on this local Linux machine.** GitHub is the **backup mirror** — always push commits there after every change.
- **One task per cycle.** Read the task file before starting. Update this board after finishing.
- **Backup rule:** Every commit must be pushed to GitHub immediately. Do not let local and remote drift.
- **T-034 sub-tasks:** T-034-a DONE, T-034-b DONE, T-034-c-1 DONE, T-034-c-2 DONE, T-034-c-3 DONE, **T-034-d DONE**. Next: T-034-e DONE. **T-034 COMPLETE.**
- **New theme added 2026-05-14:** `cosmic-drift` — animated CSS starfield with nebula haze (no JS).

---

> Wake up. Read this. Read one task file. Execute. Update. Commit. Sleep. Repeat. ⚡