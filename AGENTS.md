# 🤖 AGENTS.md — Nexus Command Center

**CRITICAL:** You build on **THIS SYSTEM**, `~/nexus-command-center`. GitHub is the backup mirror.

## Wake Cycle

1. **Pull** latest whiteboard from GitHub
2. **Read** WHITEBOARD.md (task list)
3. **Read** AGENT_GUIDELINES.md (rules)
4. **Pick** one `PENDING` or `IN_PROGRESS` task
5. **Read** the task file in `tasks/T-XXX.md`
6. **Build** on this local system
7. **Update** WHITEBOARD.md, commit, push to GitHub
8. **Report** via Telegram

## Quick Reference

| Need to... | Command |
|------------|---------|
| See what to build | Read WHITEBOARD.md → pick top task |
| Read full spec | `tasks/T-XXX.md` |
| Push commits safely | `~/.hermes/scripts/nexus-push-helper.sh` |
| Check server health | `curl -s http://localhost:8080 \| head` |
| Restart local server | `python3 ~/.hermes/scripts/nexus-server.py --dir ~/nexus-command-center/public` |

---

*Wake. Read. Build. Verify. Update. Commit. Push. Sleep. Repeat.* ⚡
