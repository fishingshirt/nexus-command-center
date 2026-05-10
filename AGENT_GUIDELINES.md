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

Every code change must pass Quality Check (QC) before merge. Stage 1 is automated, Stage 2 is agent-reviewed. **Failure always bounces back to the task file.**

### Fast-Track QC (No QA required)
- Changes ≤ 20 lines AND touches only 1 file AND the file has ≤ 2 known dependencies
- Run `python3 scripts/nexus-qc.py` → if PASS, merge immediately
- If FAIL → bounce back to task, fix, re-QC

### Medium Track (QC + lightweight QA)
- Changes between 20–50 lines OR 2 files OR touches HTML/CSS but no server
- Run QC → if PASS, agent performs 1-minute smoke test (homepage loads, no console errors, responsive check)
- Agent self-signs off via `python3 scripts/nexus-qa-checklist.py --sign-off QC-ID`
- If QA finds bugs → bounce back, fix, re-enter QC + QA

### Full Pipeline (QC + QA required)
- Changes > 50 lines OR > 2 files OR touches server (`nexus-server.py`) OR adds a new app
- Run QC → if PASS, run full QA checklist (`python3 scripts/nexus-qa-checklist.py`)
- Agent completes checklist, signs off or rejects
- If QA rejects → bounce back to task, fix, re-enter QC + QA from the beginning

### Bounce-Back Rule
- **If QC overall = FAIL:** change is NOT kept in the pipeline. Read the QC failure report, go back to `tasks/T-XXX.md`, fix bugs, re-commit, re-run QC from scratch.
- **If QA overall = FAIL:** same bounce-back. Read QA failure report, fix bugs, re-commit, re-enter QC → QA.
- On failure, `nexus-push-helper.sh` blocks push and sends a Telegram alert summarizing the failure.

### Notification
On any QC or QA failure, `nexus-push-helper.sh` sends a Telegram via `POST /api/hermes/message` with:
- Commit hash
- Failed check ID
- Status (`QC-FAILED` or `QA-FAILED`)
- Instruction: fix bugs, re-QC before merge

## 6. If Stuck
Document the blocker in a note beneath the task entry in `WHITEBOARD.md`, then move on to the next task. Do not spin for >20 min.

---

> Build like it's your own home. Every detail counts. 🤖⚡
