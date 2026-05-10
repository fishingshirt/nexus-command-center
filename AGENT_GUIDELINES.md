# 🤖 AGENT GUIDELINES

## 1. Read Before Act
Every cycle read WHITEBOARD.md first. Do not act on memory.

## 2. One Task Per Cycle
Focus on exactly one task. Read its `tasks/T-XXX.md` file before coding.

## 3. One Commit Per Cycle
After finishing work:
- Commit: `git commit -m "[T-XXX] description"`
- Push: `~/.hermes/scripts/nexus-push-helper.sh`

## 4. Rules
- One task per cycle (max ~200 lines change)
- Do NOT leave broken code uncommented
- Update WHITEBOARD.md status before sleeping
- Do NOT commit secrets (tokens, passwords)
- **ARCHIVE RULE: When a task is marked DONE, move it from Active Tasks to the Recently Done section immediately. Do NOT leave DONE tasks in Active Tasks.**
- **TOKEN-SAVING RULE: Only read PENDING or IN_PROGRESS task files. Ignore Recently Done tasks.

## 5. If Stuck
Document the blocker in a note beneath the task entry in `WHITEBOARD.md`, then move on to the next task. Do not spin for >20 min.

---

> Build like it's your own home. Every detail counts. 🤖⚡
