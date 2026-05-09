# 🤖 AGENTS.md — Nexus Command Center
# BUILD AGENT MANIFEST
# ⏰ Runs every 15 minutes on this local Linux system.
# 🖥️ The dashboard you just built is live on this machine: http://localhost:8080
#
# CRITICAL REMINDER: You build on THIS SYSTEM. NOT just on GitHub.
# GitHub is the backup mirror. The real product lives in /tmp/nexus-command-center.

---

## Your Mission (Every Wake Cycle)

1. **Sync** — Pull latest whiteboard from GitHub, read full state
2. **Pick** — Choose exactly ONE highest-priority `PENDING` task
3. **Build** — Implement it on THIS LOCAL SYSTEM (`/tmp/nexus-command-center/public/`)
4. **Verify** — Test in-browser (or at least run `node --check` for JS, inspect console)
5. **Update** — Mark task `DONE` in `WHITEBOARD.md`, add found bugs, document ideas
6. **Commit & Push** — Commit with `[TASK-ID]...`, push to GitHub (backup), restart local server
7. **Report** — Send summary to Telegram (already done by Hermes)

---

## System Architecture (You Are Here)

```
THIS LINUX MACHINE (you are building here)
├── ~/.hermes/scripts/nexus-build-sync.sh     ← This script runs before you (prints status)
├── ~/.hermes/scripts/nexus-push-helper.sh    ← This pushes commits + restarts local server
├── ~/.hermes/scripts/nexus-server.py         ← Python static server (port 8080)
│
├── /tmp/nexus-command-center/                  ← LOCAL PROJECT (this is what you edit)
│   ├── public/                                 ← Static files served by nexus-server.py
│   │   ├── index.html                          ← Dashboard shell
│   │   ├── css/base.css                        ← Core layout + CSS variables
│   │   ├── css/themes/*.css                    ← Theming (7 themes now)
│   │   ├── js/app.js                           ← Router, theme engine, settings
│   │   └── js/apps/                            ← Per-app modules (calendar, notes...)
│   ├── WHITEBOARD.md                           ← TASK BOARD (your source of truth)
│   ├── AGENT_GUIDELINES.md                     ← Behavioral rules (read every cycle)
│   └── PROJECT.md                              ← Product spec (read for context)
│
├── GitHub: /fishingshirt/nexus-command-center  ← BACKUP / MIRROR. Not the primary build target.
│
└── Local Server: http://localhost:8080       ← Live dashboard. Auto-restarts on every push.
```

### 🏗️ What "Build on Our System" Means

- You edit files in `/tmp/nexus-command-center/public/`
- You test by checking `http://localhost:8080` or `curl` responses
- The local Python server (`nexus-server.py`) serves files directly from disk
- After you push, the server restarts automatically → changes are live
- GitHub only exists as a backup and as the common source of truth for the agent task list

---

## Startup Checklist (Read Every Cycle)

### PRE-FLIGHT (nexus-build-sync.sh handles this before you wake)
- [ ] `cd /tmp/nexus-command-center && git pull origin main` → gets latest
- [ ] Prints current commit, unstaged files, pending tasks

### YOUR WAKE CYCLE (you do this)
- [ ] **READ WHITEBOARD.md fully** — this is your task source of truth
- [ ] **READ AGENT_GUIDELINES.md** — refresh rules
- [ ] **Pick ONE highest-priority `PENDING` task** (not two, not three)
- [ ] **Check for blockers** — are prerequisites done? Any open bugs blocking this?
- [ ] **IMPLEMENT IT** on the local system (HTML/CSS/JS in `/tmp/nexus-command-center/public/`)
- [ ] **Run quality checks:**
  - [ ] `node --check public/js/app.js` → syntax OK?
  - [ ] `bash -n scripts/*.sh` → syntax OK?
  - [ ] No `console.error` in any new JS
  - [ ] Themes all still render
  - [ ] Mobile breakpoints check (375px, 768px)
- [ ] **Update WHITEBOARD.md:**
  - [ ] Mark task status (`DONE` or `IN_PROGRESS` with sub-tasks)
  - [ ] Add any bugs you found to BUG TRACKER
  - [ ] Add any ideas to MISSING FEATURES
  - [ ] Update CURRENT STATUS metrics (completed tasks count)
- [ ] **COMMIT:** `git add . && git commit -m "[TASK-ID] description"`
- [ ] **PUSH (auto-restarts server):** Run `~/.hermes/scripts/nexus-push-helper.sh`
  - Injects GitHub token → pushes → scrubs token → **restarts local server**
- [ ] **Final check:** `curl -s http://localhost:8080 | head -5` → confirms server alive

---

## The GitHub/Local Relationship

| Action | Where It Happens |
|--------|------------------|
| Build & edit code | THIS SYSTEM (`/tmp/nexus-command-center/`) |
| Serve the dashboard | THIS SYSTEM (`http://localhost:8080`) |
| Store task list | `WHITEBOARD.md` (synced via GitHub → other agents can read it too) |
| Backup commits | GitHub (`main` branch) |
| Agent wakes | Hermes cron on THIS SYSTEM |
| Dashboard visible | Browser on THIS SYSTEM (or forwarded) |

**Critical rule:** GitHub is a BACKUP. The live build is on this machine. Every commit MUST be pushed so the task board is shared, but the product itself is served locally.

---

## Local Server Management

The server is `nexus-server.py` (Python standard library only, zero dependencies).

```bash
# Check if server is running:
curl -s http://localhost:8080 | head -1

# If NOT running, start it:
nohup python3 ~/.hermes/scripts/nexus-server.py --dir /tmp/nexus-command-center/public > /tmp/nexus-server.log 2>&1 &

# The push-helper restarts it automatically after every git push.
```

If the server port 8080 is blocked:
```bash
python3 ~/.hermes/scripts/nexus-server.py --port 8081 --dir /tmp/nexus-command-center/public
# Update the dashboard URL to http://localhost:8081
```

---

## Project Constraints (Non-Negotiable)

| Constraint | Value |
|------------|-------|
| **Tech stack** | Pure HTML / CSS / JS. NO build step. NO npm. |
| **Mobile-first** | Design for 375px first, scale up |
| **Theming** | All colors via CSS custom properties. No hardcoded hex codes in base.css |
| **Storage** | `localStorage` with `ncc-` prefix keys |
| **App pattern** | Self-contained modules that register in the app registry |
| **PWA** | Must work offline. Service worker caches assets |
| **Docker** | Designed for `docker-compose up` (future — nginx:alpine) |
| **File limit** | Max 200 lines change per commit. Break large tasks into sub-tasks. |

---

## What NOT To Do

- ❌ **Do NOT change >200 lines or work >2 hours** without breaking into sub-tasks
- ❌ **Do NOT work on more than one task per cycle**
- ❌ **Do NOT add npm, webpack, vite, or any build tool**
- ❌ **Do NOT leave broken / half-finished code uncommented**
- ❌ **Do NOT forget to update WHITEBOARD.md**
- ❌ **Do NOT push without committing**
- ❌ **Do NOT restart the server without confirming it starts**
- ❌ **Do NOT ignore the mobile viewport**
- ❌ **Do NOT hardcode colors in base.css**
- ❌ **Do NOT commit secrets (tokens) to the repo**

---

## Agent Stats Tracking

The dashboard expects agent activity stats in `localStorage` key `ncc-settings` → `agentStats`:

```json
{
  "agentStats": {
    "tasksDone": 14,
    "bugsFixed": 0,
    "commits": 6,
    "wakeCycles": 27,
    "lastRun": "2026-05-09T01:30:00Z",
    "nextRun": "2026-05-09T01:45:00Z"
  }
}
```

**Every cycle, update these stats:**
```javascript
// At the end of each wake cycle:
const s = JSON.parse(localStorage.getItem('ncc-settings') || '{}');
s.agentStats = s.agentStats || {};
s.agentStats.wakeCycles = (s.agentStats.wakeCycles || 0) + 1;
s.agentStats.lastRun = new Date().toISOString();
// Calculate next run based on cron schedule (every 15 min)
const next = new Date(Date.now() + 15 * 60000);
s.agentStats.nextRun = next.toISOString();
if (taskCompleted) s.agentStats.tasksDone = (s.agentStats.tasksDone || 0) + 1;
// After git commit succeeds:
const commitCount = /* parse from git log or count commits since start */;
s.agentStats.commits = commitCount;
localStorage.setItem('ncc-settings', JSON.stringify(s));
```

---

## Troubleshooting

### "Port 8080 already in use"
```bash
lsof -i :8080  # or: ss -tlnp | grep 8080
kill <PID>
# Restart server
```

### "Git push fails"
```bash
# Check token valid:
export GITHUB_TOKEN=$(grep "^GITHUB_TOKEN=" ~/.hermes/.env | cut -d= -f2)
curl -s -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user | grep login

# If token OK, remote may be dirty:
git status
git reset --hard HEAD  # ⚠️ destructive — only if you know nothing local matters
```

### "WHITEBOARD.md missing after pull"
```bash
cd /tmp/nexus-command-center && git log --oneline HEAD~5..HEAD
# If whiteboard is missing, the repo may be in a bad state. Report it.
```

---

## Quick Reference

| Need to... | Command / File |
|------------|----------------|
| Know what to build now | `cat WHITEBOARD.md` → read Task Board |
| Push commits safely | `~/.hermes/scripts/nexus-push-helper.sh` |
| Check server health | `curl -s http://localhost:8080 \| head -1` |
| Restart local server | `python3 ~/.hermes/scripts/nexus-server.py --dir /tmp/nexus-command-center/public` |
| Check JS syntax | `node --check public/js/app.js` |
| Check shell syntax | `bash -n scripts/*.sh` |
| See recent commits | `git log --oneline -5` |
| See uncommitted changes | `git status --short` |
| Fix merge conflict | `git reset --hard HEAD` (⚠️ discards local changes) |

---

*Wake up. Read. Build. Verify. Update. Commit. Push. Restart. Sleep. Repeat.* ⚡
