# 🤖 AGENTS.md — Nexus Command Center

> **You are the autonomous build agent for this project.**
> This file is auto-loaded by Hermes every time the cron job wakes you up.

---

## Your Mission

Every 15 minutes, you wake up, read the whiteboard, execute **exactly one** highest-priority pending task, update the whiteboard with progress, commit, push, and report a brief summary.

---

## Entry Points (Read These In Order)

1. **WHITEBOARD.md** — Current status, task board, bug tracker, missing features. This is your primary source of truth.
2. **AGENT_GUIDELINES.md** — Your behavioral rules: task size limits, bug protocol, commit format, code quality standards.
3. **PROJECT.md** — Full product specification if you need architectural context.

---

## Quick Reference

| Need to... | Look at... |
|------------|------------|
| Know what to build now | WHITEBOARD.md → Task Board (top = highest priority) |
| Know how to behave | AGENT_GUIDELINES.md |
| Understand the product vision | PROJECT.md |
| See the file structure | WHITEBOARD.md → File Map |
| Check if a task is too big | AGENT_GUIDELINES.md §2.1 (max 2hrs / 200 lines) |
| Know how to report bugs | AGENT_GUIDELINES.md §3.2 |
| Know commit format | AGENT_GUIDELINES.md §6.1 |

---

## Startup Checklist (Every Wake Cycle)

- [ ] Run the push-helper script first (handles auth): `~/.hermes/scripts/nexus-push-helper.sh`
- [ ] `git pull origin main` — sync latest changes
- [ ] Read WHITEBOARD.md fully
- [ ] Read AGENT_GUIDELINES.md (refresh your rules)
- [ ] Pick ONE highest-priority `PENDING` task
- [ ] Implement it
- [ ] Run quality checks (console, responsive, themes, a11y)
- [ ] Update WHITEBOARD.md (status, bugs, ideas)
- [ ] `git add . && git commit -m "[TASK-ID] description"`
- [ ] Run the push-helper script again: `~/.hermes/scripts/nexus-push-helper.sh`
- [ ] Report summary

### Git Push Helper

The helper script injects the GitHub token into the remote URL, pushes, then cleans it up. Use it instead of typing `git push` directly.

```bash
~/.hermes/scripts/nexus-push-helper.sh
```

If the script is unavailable, use this pattern manually:

```bash
export GITHUB_TOKEN=$(grep "^GITHUB_TOKEN=" ~/.hermes/.env | head -1 | cut -d= -f2 | tr -d '\n\r')
git remote set-url origin "https://${GITHUB_TOKEN}@github.com/fishingshirt/nexus-command-center.git"
git push origin main
git remote set-url origin "https://github.com/fishingshirt/nexus-command-center.git"
```

---

## Project Constraints

| Constraint | Value |
|------------|-------|
| **Tech stack** | Pure HTML / CSS / JS. NO build step. NO npm. |
| **Mobile-first** | Design for 375px first, scale up |
| **Theming** | All colors via CSS custom properties. No hardcoded hex codes in base.css |
| **Storage** | `localStorage` with `ncc-` prefix keys |
| **App pattern** | Self-contained modules that register in the app registry |
| **PWA** | Must work offline. Service worker caches assets |
| **Docker** | Single `docker-compose up` deploys everything |

---

## What NOT To Do

- ❌ Do NOT work on more than one task per cycle
- ❌ Do NOT add npm, webpack, vite, or any build tool
- ❌ Do NOT leave broken / half-finished code uncommented
- ❌ Do NOT forget to update WHITEBOARD.md
- ❌ Do NOT push without committing
- ❌ Do NOT ignore the mobile viewport
- ❌ Do NOT hardcode colors in base.css

---

*Wake up. Build. Sleep. Repeat.* ⚡
