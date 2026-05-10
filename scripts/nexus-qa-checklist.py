#!/usr/bin/env python3
"""
nexus-qa-checklist.py — QA Agent Review Checklist & Sign-Off System
Purpose: Stage 2 quality approval. When QC passes, this script generates a
human-level review checklist that the agent must follow before merge.

Usage:
    python3 scripts/nexus-qa-checklist.py             # auto-detect latest QC-PASSED
    python3 scripts/nexus-qa-checklist.py QC-12345    # target specific QC entry
    python3 scripts/nexus-qa-checklist.py --sign-off QC-12345  # write QA result

Exit codes:
    0 = checklist generated or signed off successfully
    1 = no QC-PASSED entry found, or sign-off rejected
"""

import json
import os
import sys
import re
import subprocess
import hashlib
import time
from pathlib import Path
from datetime import datetime, timezone

SCRIPT_DIR   = Path(__file__).resolve().parent
REPO_ROOT    = SCRIPT_DIR.parent
PUBLIC_DIR   = REPO_ROOT / "public"
JS_DIR       = PUBLIC_DIR / "js"
APPS_JS_DIR  = JS_DIR / "apps"
CSS_DIR      = PUBLIC_DIR / "css"
HTML_PATH    = PUBLIC_DIR / "index.html"
SERVER_PATH  = SCRIPT_DIR / "nexus-server.py"

QUEUE_PATH   = Path.home() / ".hermes" / "nexus-quality-queue.json"
QA_LOG       = Path.home() / ".hermes" / "nexus-qa-log.ndjson"

# ─── Helpers ───────────────────────────────────────────────────────

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def ensure_dir(p: Path):
    p.parent.mkdir(parents=True, exist_ok=True)

def load_json(p: Path):
    if p.exists():
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_json(p: Path, obj):
    ensure_dir(p)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)
        f.write("\n")

def append_log(p: Path, obj):
    ensure_dir(p)
    with open(p, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj) + "\n")

def get_git_head():
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=REPO_ROOT, text=True).strip()
    except Exception:
        return "unknown"

def find_latest_qc_passed(queue):
    """Return the most recent QC-PASSED entry that has no QA sign-off yet."""
    items = queue.get("queue", [])
    for item in items:
        if item.get("status") == "QC-PASSED":
            qc_id = item.get("id")
            # Check if already signed off
            qa_id = f"QA-{qc_id}"
            already = any(q.get("parent_qc") == qc_id for q in items if q.get("stage") == "QA")
            if not already:
                return item
    return None

def find_qc_by_id(queue, qc_id):
    for item in queue.get("queue", []):
        if item.get("id") == qc_id:
            return item
    return None

def collect_changed_files(qc_entry):
    return qc_entry.get("files", [])

def gather_code_context(files):
    """Collect JS/CSS/HTML context for the review checklist."""
    context = {
        "js_files": [],
        "css_files": [],
        "html_files": [],
        "server_changed": False,
        "apps_touched": [],
    }
    for f in files:
        if f.endswith(".js"):
            context["js_files"].append(f)
            m = re.search(r"apps/([a-z0-9_-]+)\.js", f)
            if m:
                context["apps_touched"].append(m.group(1))
        elif f.endswith(".css"):
            context["css_files"].append(f)
        elif f.endswith(".html"):
            context["html_files"].append(f)
        elif "nexus-server.py" in f:
            context["server_changed"] = True
    return context

def build_checklist(qc_entry):
    files = collect_changed_files(qc_entry)
    ctx = gather_code_context(files)
    qc_id = qc_entry.get("id", "UNKNOWN")
    commit = qc_entry.get("commit", "unknown")
    checklist_path = Path.home() / ".hermes" / f"qa-checklist-{qc_id}.md"

    lines = []
    lines.append(f"# QA Checklist — {qc_id}")
    lines.append("")
    lines.append(f"- **QC ID:** `{qc_id}`")
    lines.append(f"- **Commit:** `{commit}`")
    lines.append(f"- **Generated:** {now_iso()}")
    lines.append(f"- **Files changed:** {len(files)}")
    lines.append("")
    lines.append("## 1. Logic & Edge Case Review")
    lines.append("")
    lines.append("For every JS file changed, verify the following manually:")
    lines.append("")

    if ctx["js_files"]:
        for jsf in ctx["js_files"]:
            lines.append(f"- [ ] **`{jsf}`**")
            lines.append("  - [ ] No race conditions in async/await flows")
            lines.append("  - [ ] No null dereference without guards (`?.` or `if (x)`)")
            lines.append("  - [ ] State keys used match existing `localStorage` schema")
            lines.append("  - [ ] Event listeners have corresponding cleanup (remove/abort)")
            lines.append("  - [ ] No unhandled Promise rejections")
    else:
        lines.append("- [ ] No JS files changed — review skipped")

    lines.append("")
    lines.append("## 2. Functional Test Plan")
    lines.append("")
    lines.append("Run these checks in a real browser / curl session:")
    lines.append("")

    if ctx["apps_touched"]:
        for app in ctx["apps_touched"]:
            lines.append(f"- [ ] **App:** `{app}`")
            lines.append(f"  - [ ] Feature area works (open app, perform primary action)")
            lines.append(f"  - [ ] Edge case 1: empty state / no data")
            lines.append(f"  - [ ] Edge case 2: rapid interaction (double-click, fast toggle)")
            lines.append(f"  - [ ] Edge case 3: large input / max-length overflow")
            lines.append(f"  - [ ] Mobile (375px): layout does not overflow, text wraps")
            lines.append(f"  - [ ] Desktop (1920px): grid scales correctly")
            lines.append(f"  - [ ] Light theme: no hardcoded dark colors")
            lines.append(f"  - [ ] Dark theme: no hardcoded light colors")
            lines.append(f"  - [ ] Offline: app degrades gracefully (no white screen)")
    else:
        lines.append("- [ ] No app-specific changes — run general smoke tests")

    lines.append("")
    lines.append("- [ ] **Cross-browser:** Chrome / Firefox / Safari (at least one)")
    lines.append("- [ ] **Console check:** zero `TypeError`, `ReferenceError`, or `console.error`")

    lines.append("")
    lines.append("## 3. Site Load Verification")
    lines.append("")
    lines.append("- [ ] Homepage loads without FOUC (flash of unstyled content)")
    lines.append("- [ ] Service Worker registers (DevTools → Application → Service Workers)")
    lines.append("- [ ] All dashboard apps are visible in the grid (none missing")
    lines.append("- [ ] No 404s in Network tab for JS/CSS assets")

    lines.append("")
    lines.append("## 4. Regression Check")
    lines.append("")
    lines.append("- [ ] `node validate-js.js` passes (if exists)")
    lines.append("- [ ] `python3 scripts/nexus-qc.py --all` still passes (run again)")
    lines.append("- [ ] Server starts clean: `python3 scripts/nexus-server.py --help` returns 0")
    if ctx["server_changed"]:
        lines.append("- [ ] **Server changed:** verify new/modified API endpoint responds with correct JSON")
    lines.append("- [ ] Curl smoke test against `http://localhost:8080` returns 200")
    lines.append("- [ ] Curl random app route (e.g. `/api/health`) returns valid JSON")

    lines.append("")
    lines.append("## 5. Security & Privacy")
    lines.append("")
    lines.append("- [ ] No secrets, tokens, or passwords in committed files")
    lines.append("- [ ] No dynamic code execution (eval / Function constructor)")
    lines.append("- [ ] No unsafe innerHTML with user-provided strings")
    lines.append("- [ ] `localStorage` keys use project prefix (`ncc-`)")

    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Agent Sign-Off")
    lines.append("")
    lines.append("After completing the checklist above, run:")
    lines.append("")
    lines.append(f"```bash")
    lines.append(f"python3 scripts/nexus-qa-checklist.py --sign-off {qc_id}")
    lines.append(f"```")
    lines.append("")
    lines.append("If any item FAILED, do NOT sign off. Instead:")
    lines.append("1. Fix the bug in the relevant file.")
    lines.append("2. Re-commit and re-run QC from the beginning.")
    lines.append("3. Do NOT merge until both QC and QA pass.")
    lines.append("")

    content = "\n".join(lines)
    ensure_dir(checklist_path)
    with open(checklist_path, "w", encoding="utf-8") as f:
        f.write(content)

    return checklist_path, content

def sign_off(qc_id, passed=True, notes=""):
    queue = load_json(QUEUE_PATH)
    qc_entry = find_qc_by_id(queue, qc_id)
    if not qc_entry:
        print(f"❌ QC entry '{qc_id}' not found in queue.")
        sys.exit(1)

    if qc_entry.get("status") != "QC-PASSED":
        print(f"❌ QC entry '{qc_id}' is not in QC-PASSED state (current: {qc_entry.get('status')}).")
        sys.exit(1)

    qa_id = f"QA-{qc_id}"
    result = {
        "id": qa_id,
        "timestamp": now_iso(),
        "parent_qc": qc_id,
        "commit": qc_entry.get("commit", get_git_head()),
        "stage": "QA",
        "overall": "PASSED" if passed else "FAILED",
        "signed_by": "agent",
        "signed_at": now_iso(),
        "notes": notes,
        "next_action": "Ready for merge" if passed else "BLOCKED — fix failures and re-enter QC"
    }

    queue.setdefault("queue", []).insert(0, result)
    save_json(QUEUE_PATH, queue)
    append_log(QA_LOG, result)

    print("═" * 60)
    print("  NEXUS QA — Agent Review Sign-Off")
    print("═" * 60)
    print(f"  QA ID:     {qa_id}")
    print(f"  Parent QC: {qc_id}")
    print(f"  Commit:    {result['commit']}")
    print(f"  Overall:   {result['overall']}")
    if notes:
        print(f"  Notes:     {notes}")
    print("-" * 60)

    if passed:
        print("\n✅ QA PASSED — change is cleared for merge.")
    else:
        print("\n🛑 QA FAILED — change is bounced back to the task file.")
        print("   Fix failures, re-commit, and re-run QC from the beginning.")
        # Notify user via Hermes bridge (best-effort)
        try:
            import json as _json, urllib.request
            _msg = f"🛑 QA FAILED\nCommit: {result['commit']}\nCheck: {qa_id}\nParent QC: {qc_id}\nStatus: QA-FAILED\nFix bugs and re-enter QC+QA before merge."
            _data = _json.dumps({"text": _msg}).encode('utf-8')
            _req = urllib.request.Request('http://localhost:8080/api/hermes/message', data=_data, headers={'Content-Type':'application/json'}, method='POST')
            urllib.request.urlopen(_req, timeout=5)
        except Exception:
            pass
        sys.exit(1)

# ─── Main ────────────────────────────────────────────────────────────

def main():
    args = sys.argv[1:]

    if len(args) >= 2 and args[0] == "--sign-off":
        qc_id = args[1]
        notes = " ".join(args[2:]) if len(args) > 2 else ""
        sign_off(qc_id, passed=True, notes=notes)
        return

    if len(args) >= 2 and args[0] == "--reject":
        qc_id = args[1]
        notes = " ".join(args[2:]) if len(args) > 2 else ""
        sign_off(qc_id, passed=False, notes=notes)
        return

    qc_id = None
    if args:
        qc_id = args[0]

    queue = load_json(QUEUE_PATH)

    if qc_id:
        qc_entry = find_qc_by_id(queue, qc_id)
        if not qc_entry:
            print(f"❌ QC entry '{qc_id}' not found in queue.")
            sys.exit(1)
    else:
        qc_entry = find_latest_qc_passed(queue)
        if not qc_entry:
            print("❌ No QC-PASSED entries awaiting QA review.")
            print("   Run QC first: python3 scripts/nexus-qc.py")
            sys.exit(1)
        qc_id = qc_entry["id"]

    checklist_path, content = build_checklist(qc_entry)

    print("═" * 60)
    print("  NEXUS QA — Review Checklist Generated")
    print("═" * 60)
    print(f"  QC ID:   {qc_id}")
    print(f"  Commit:  {qc_entry.get('commit', 'unknown')}")
    print(f"  Files:   {len(qc_entry.get('files', []))}")
    print(f"  Path:    {checklist_path}")
    print("-" * 60)
    print("\n Follow the checklist, then sign off with:")
    print(f"   python3 scripts/nexus-qa-checklist.py --sign-off {qc_id}")
    print("=" * 60)

if __name__ == "__main__":
    main()
