# 🤖 Nexus Agent Task Board

> **Single source of truth.** The agent reads this first every wake cycle.
> For full details on any task, read the linked file in `tasks/`.

---

## 📊 Status Snapshot

- **Project phase:** Agent Task System
- **Last updated:** 2026-05-10 10:18 UTC
- **Active tasks:** 10
- **Completed tasks:** 22 shown below
---

## 🎯 Active Tasks

| Priority | ID | Task | Status | Details |
|----------|----|------|--------|---------|
| HIGH | `T-013` | Data persistence layer | `IN_PROGRESS` | [`tasks/T-013.md`](tasks/T-013.md) — Sub-tasks: **T-013-a DONE** (StorageAdapter + server endpoints), T-013-b (legacy migration), T-013-c (per-app audit), T-013-d (settings bridge), T-013-e (offline badge), T-013-f (integrity guard) |
| MEDIUM | `T-017` | Spotify integration | `PENDING` | [`tasks/T-017.md`](tasks/T-017.md) |
| MEDIUM | `T-018` | RSS feed reader | `PENDING` | [`tasks/T-018.md`](tasks/T-018.md) |
| MEDIUM | `T-019` | Finance tracker | `PENDING` | [`tasks/T-019.md`](tasks/T-019.md) |
| MEDIUM | `T-020` | AI task suggester | `PENDING` | [`tasks/T-020.md`](tasks/T-020.md) |
| HIGH | `T-025` | Smart PDF Editor | `PENDING` | [`tasks/T-025.md`](tasks/T-025.md) |
| HIGH | `T-031` | Cloud Vault | `PENDING` | [`tasks/T-031.md`](tasks/T-031.md) |
| HIGH | `T-032` | Email Agent / Smart Inbox | `PENDING` | [`tasks/T-032.md`](tasks/T-032.md) |
| MEDIUM | `T-039` | Multi-city weather manager | `PENDING` | [`tasks/T-039.md`](tasks/T-039.md) |
| MEDIUM | `T-040` | Customizable dashboard widget grid | `PENDING` | [`tasks/T-040.md`](tasks/T-040.md) |
| MEDIUM | `T-041` | Global search bar | `PENDING` | [`tasks/T-041.md`](tasks/T-041.md) |
| MEDIUM | `T-043` | Quick capture widget (voice + fast entry) | `PENDING` | [`tasks/T-043.md`](tasks/T-043.md) |
|| LOW | `T-046` | Auto dark mode + system theme sync | `PENDING` | [`tasks/T-046.md`](tasks/T-046.md) |
| MEDIUM | `T-047` | Keyboard shortcuts / hotkey system | `PENDING` | [`tasks/T-047.md`](tasks/T-047.md) |
| LOW | `T-048` | Usage analytics & screen time | `PENDING` | [`tasks/T-048.md`](tasks/T-048.md) |
| MEDIUM | `T-049` | File attachments for notes & calendar | `PENDING` | [`tasks/T-049.md`](tasks/T-049.md) |
| LOW | `T-050` | Bookmark manager | `PENDING` | [`tasks/T-050.md`](tasks/T-050.md) |
| LOW | `T-051` | Post-completion QA & continuous improvement loop | `PENDING` | [`tasks/T-051.md`](tasks/T-051.md) |
| HIGH | `T-052` | Project completion sentinel (pause agent, notify user) | `PENDING` | [`tasks/T-052.md`](tasks/T-052.md) |

---

## ✅ Recently Done

| ID | Task |
|----|------|
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

---

## 🐛 Bug Tracker

|| ID | Description | Severity | Status |
||----|-------------|----------|--------|
||| B-001 | Missing `tasks/*.md` files for T-016, T-021, T-022, T-023, T-024, T-026, T-030, T-033, T-035, T-036, T-037, T-038. WHITEBOARD points to non-existent files. | LOW | OPEN |
||| B-002 | Calendar Google sync was one-way read-only via public API key. T-034 implemented OAuth token exchange, outbound events.insert/patch/delete, conflict resolution, offline queue, agent commands, and re-authorize prompt. | HIGH | **FIXED** |
|| B-003 | `calendar.js` event save does not check for overlapping time slots. | LOW | OPEN |

---

## 📝 Agent Notes

- **Tech stack:** Pure HTML/CSS/JS dashboard (no build step) + Python server on local machine.
- **This repo lives on this local Linux machine.** GitHub is the **backup mirror** — always push commits there after every change.
- **One task per cycle.** Read the task file before starting. Update this board after finishing.
- **Backup rule:** Every commit must be pushed to GitHub immediately. Do not let local and remote drift.
- **T-034 sub-tasks:** T-034-a DONE, T-034-b DONE, T-034-c-1 DONE, T-034-c-2 DONE, T-034-c-3 DONE, **T-034-d DONE**. Next: T-034-e (scope upgrade + re-auth prompt) then finish T-034.

---

> Wake up. Read this. Read one task file. Execute. Update. Commit. Sleep. Repeat. ⚡
