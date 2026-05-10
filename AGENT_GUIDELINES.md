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

## 5. Quality Gate Rules (QC/QA Pipeline — T-060)
Every code change must pass Quality Check (QC) before merge.
- **Run QC before push:** After coding but before `nexus-push-helper.sh`, run: `python3 scripts/nexus-qc.py`
- **If QC fails:** The change is **bounced back to the task file.** Do NOT push. Go back to `tasks/T-XXX.md`, fix the bugs, re-run QC.
- **If QA fails:** The change is **bounced back to the task file.** Do NOT push. Go back to `tasks/T-XXX.md`, fix the bugs, re-run QC from the beginning.
- **Fast-track:** ≤20 lines + 1 file + ≤2 deps → QC only, then merge.
- **Full pipeline:** >50 lines OR >2 files OR touches server → QC + QA required.
- **Push helper blocks failed pushes:** `nexus-push-helper.sh` checks the quality queue and blocks the push if any FAILED entry exists for the current commit.

## 6. If Stuck
Document the blocker in a note beneath the task entry in `WHITEBOARD.md`, then move on to the next task. Do not spin for >20 min.

---

> Build like it's your own home. Every detail counts. 🤖⚡
