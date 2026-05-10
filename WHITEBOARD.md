# 🤖 Nexus Agent Task Board

> **Single source of truth.** The agent reads this first every wake cycle.
> For full details on any task, read the linked file in `tasks/`.

---

## 📊 Status Snapshot

- **Project phase:** Agent Task System
- **Last updated:** 2026-05-10
- **Active tasks:** 10
- **Completed tasks:** 19 shown below

---

## 🎯 Active Tasks

||| Priority | ID | Task | Status | Details |
||----------|----|------|--------|---------|
|| HIGH | `T-034` | Google Calendar two-way sync audit & fix | `IN_PROGRESS` | [`tasks/T-034.md`](tasks/T-034.md) |
|| HIGH | `T-013` | Data persistence layer | `PENDING` | [`tasks/T-013.md`](tasks/T-013.md) |
|| MEDIUM | `T-017` | Spotify integration | `PENDING` | [`tasks/T-017.md`](tasks/T-017.md) |
|| MEDIUM | `T-018` | RSS feed reader | `PENDING` | [`tasks/T-018.md`](tasks/T-018.md) |
|| MEDIUM | `T-019` | Finance tracker | `PENDING` | [`tasks/T-019.md`](tasks/T-019.md) |
|| MEDIUM | `T-020` | AI task suggester | `PENDING` | [`tasks/T-020.md`](tasks/T-020.md) |
|| HIGH | `T-025` | Smart PDF Editor | `PENDING` | [`tasks/T-025.md`](tasks/T-025.md) |
|| HIGH | `T-029` | IT Hub / System health | `PENDING` | [`tasks/T-029.md`](tasks/T-029.md) |
|| MEDIUM | `T-031` | Cloud Vault | `PENDING` | [`tasks/T-031.md`](tasks/T-031.md) |
|| HIGH | `T-032` | Email Agent / Smart Inbox | `PENDING` | [`tasks/T-032.md`](tasks/T-032.md) |

---

## ✅ Recently Done

|| ID | Task |
||----|------|
|| `T-039` | Multi-city weather manager |
|| `T-009` | Calendar app (views, CRUD, recurrence, Google sync) |
|| `T-010` | Notes app (CRUD, search, auto-save) |
|| `T-011` | To-Do app (lists, priorities, recurring, filters) |
|| `T-014` | Opt-in auth system (PIN overlay, per-app lock) |
|| `T-015` | Offline mode + enhanced service worker |
|| `T-016` | Weather widget (Open-Meteo, geocoding) |
|| `T-021` | Feedback AI (form, questions, whiteboard generator) |
|| `T-022` | Agent Stats Panel (live metrics, heartbeat, notifications) |
|| `T-023` | Jarvis theme |
|| `T-024` | Phone Bridge (ADB detect, SMS read/send, threads) |
|| `T-026` | Mini Games Arcade core (Snake, Pong, Tetromino, Minesweeper, 2048, Typing) |
|| `T-030` | Backup & Recovery (USB, encrypted archives, restore) |
|| `T-033` | Welcome rebrand (cinematic onboarding) |
|| `T-035` | Nexus logo home button |
|| `T-036` | Stocks & crypto + paper trading |
|| `T-037` | Settings icon relocation |
|| `T-038` | Logic bug sweep (calendar, notes, phone-bridge, auth, finance) |
|| `T-012` | Hermes API bridge (Telegram Bot API relay + dashboard chat polling) |

---

## 🐛 Bug Tracker

|| ID | Description | Severity | Status |
||----|-------------|----------|--------|
|| B-001 | Missing `tasks/*.md` files for T-013, T-016, T-021, T-022, T-023, T-024, T-026, T-030, T-033, T-035, T-036, T-037, T-038. WHITEBOARD points to non-existent files. | LOW | OPEN |
|| B-002 | Calendar Google sync is one-way read-only via public API key. No OAuth token exchange, no outbound `events.insert/patch/delete`. T-034 addresses this. | HIGH | IN_PROGRESS |
|| B-003 | `calendar.js` event save does not check for overlapping time slots. | LOW | OPEN |

---

## 📝 Agent Notes

- **Tech stack:** Pure HTML/CSS/JS dashboard (no build step) + Python server on local machine.
- **This repo lives on this local Linux machine.** GitHub is the **backup mirror** — always push commits there after every change.
- **One task per cycle.** Read the task file before starting. Update this board after finishing.
- **Backup rule:** Every commit must be pushed to GitHub immediately. Do not let local and remote drift.
- **T-034 sub-tasks created:** `T-034-a` (OAuth token flow), `T-034-b` (Outbound sync engine), `T-034-c` (Conflict resolution), `T-034-d` (Agent calendar endpoint). These must be completed before T-034 can be marked DONE.

---

> Wake up. Read this. Read one task file. Execute. Update. Commit. Sleep. Repeat. ⚡
