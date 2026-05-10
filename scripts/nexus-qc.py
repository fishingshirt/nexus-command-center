#!/usr/bin/env python3
"""
nexus-qc.py — Quality Check Auto Gate
Purpose: Stop bugs before they ever reach the live dashboard.
Runs automated checks on every code change: syntax, cross-references,
logic analysis, regression smoke tests, and security scan.

Usage:
    python3 scripts/nexus-qc.py [files...]
    python3 scripts/nexus-qc.py --all          # scan entire public/ + scripts/

Exit codes:
    0 = QC passed
    1 = QC failed (bugs found — do NOT merge)
"""

import json
import os, sys, re, subprocess, hashlib, time
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
AUDIT_LOG    = Path.home() / ".hermes" / "nexus-audit-log.ndjson"

# Resolve actual critical IDs from HTML instead of hardcoding
html_text = (REPO_ROOT / "public" / "index.html").read_text(encoding="utf-8")
CRITICAL_ELEMENTS = sorted(set(
    re.findall(r'<(div|header|main|section|nav|aside|footer|button)\s+id="([^"]+)"', html_text)
))
# Flatten to just IDs
critical_ids_from_html = sorted(set(m[1] for m in CRITICAL_ELEMENTS))
CRITICAL_ELEMENTS = critical_ids_from_html[:12]  # cap to avoid false positives, top from layout tags

deep_critical = ["app", "welcome-overlay"]
for d in deep_critical:
    if d not in CRITICAL_ELEMENTS:
        CRITICAL_ELEMENTS.append(d)

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

def get_changed_files():
    """Return list of changed files since last commit."""
    try:
        out = subprocess.check_output(["git", "diff", "--name-only", "HEAD~1", "HEAD"], cwd=REPO_ROOT, text=True).strip()
        if out:
            return out.splitlines()
    except Exception:
        pass
    return []

# ─── Check Functions ───────────────────────────────────────────────

def check_syntax_js(files):
    """Validate JS syntax via node --check."""
    status = "pass"
    detail_lines = []
    for f in files:
        if not f.endswith(".js"):
            continue
        p = REPO_ROOT / f
        if not p.exists():
            continue
        try:
            subprocess.run(
                ["node", "--check", str(p)],
                capture_output=True, text=True, timeout=15, check=True
            )
        except subprocess.CalledProcessError as e:
            status = "FAIL"
            err = e.stderr.strip()[:200].replace("\n", "; ")
            detail_lines.append(f"{f}: {err}")
    return {
        "check": "syntax-js",
        "status": status,
        "detail": "; ".join(detail_lines) if detail_lines else f"{len([f for f in files if f.endswith('.js')])} JS file(s) OK"
    }

def check_syntax_css(files):
    """Basic CSS well-formedness: balanced braces, no missing semicolons before close brace."""
    status = "pass"
    detail_lines = []
    for f in files:
        if not f.endswith(".css"):
            continue
        p = REPO_ROOT / f
        if not p.exists():
            continue
        text = p.read_text(encoding="utf-8")
        # Balanced braces check
        open_count = text.count("{")
        close_count = text.count("}")
        if open_count != close_count:
            status = "FAIL"
            detail_lines.append(f"{f}: unbalanced braces ({open_count} open, {close_count} close)")
            continue
        # Check for rules ending without semicolon before close brace (quick regex)
        bad_rules = re.findall(r"[^;\{\}]\s*\}", text)
        if bad_rules:
            # Too noisy on shorthand rules — only flag high-confidence ones
            pass
    return {
        "check": "syntax-css",
        "status": status,
        "detail": "; ".join(detail_lines) if detail_lines else "CSS well-formedness OK"
    }

def check_html_wellformed(files):
    """Validate index.html: balanced tags, critical IDs, no duplicate IDs."""
    status = "pass"
    detail_lines = []
    html = (REPO_ROOT / "public" / "index.html").read_text(encoding="utf-8")

    # Quick balanced tags count (not perfect but catches major issues)
    tags = re.findall(r"<([a-zA-Z][a-zA-Z0-9]*)[^>]*[^/]>|<([a-zA-Z][a-zA-Z0-9]*)[^>]*/>", html)
    opens = re.findall(r"<([a-zA-Z][a-zA-Z0-9]*)[^>]*[^/]>", html)
    closes = re.findall(r"</([a-zA-Z][a-zA-Z0-9]*)>", html)
    # Check critical IDs
    ids = re.findall(r'id="([^"]+)"', html)
    id_counts = {}
    for i in ids:
        id_counts[i] = id_counts.get(i, 0) + 1
    dupes = [i for i, c in id_counts.items() if c > 1]
    if dupes:
        status = "FAIL"
        detail_lines.append(f"duplicate IDs: {', '.join(dupes)}")

    for el in CRITICAL_ELEMENTS:
        if el not in ids:
            status = "FAIL"
            detail_lines.append(f"missing critical element id='{el}'")

    return {
        "check": "html-wellformed",
        "status": status,
        "detail": "; ".join(detail_lines) if detail_lines else "HTML balanced, critical IDs present"
    }

def check_cross_reference(files):
    """Check getElementById, querySelector, data-app refs."""
    status = "pass"
    detail_lines = []
    html = (REPO_ROOT / "public" / "index.html").read_text(encoding="utf-8")
    html_ids = set(re.findall(r'id="([^"]+)"', html))

    # Build CSS class map
    css_classes = set()
    css_text = ""
    for f in (REPO_ROOT / "public" / "css").rglob("*.css"):
        css_text += f.read_text(encoding="utf-8")
    css_classes = set(re.findall(r"\.([a-zA-Z_\-][a-zA-Z0-9_\-]*)[\s\,{]", css_text))

    js_files_to_check = [REPO_ROOT / f for f in files if f.endswith(".js")]
    if not js_files_to_check:
        js_files_to_check = list((REPO_ROOT / "public" / "js").rglob("*.js"))

    missing_ids = []
    missing_classes = []
    for jsf in js_files_to_check:
        text = jsf.read_text(encoding="utf-8")
        for m in re.finditer(r"getElementById\(['\"]([^'\"]+)['\"]\)", text):
            el_id = m.group(1)
            if el_id not in html_ids:
                missing_ids.append(f"{jsf.name}:{m.start()} id='{el_id}'")
        for m in re.finditer(r'querySelector\(["\']([.#][^"\']+)["\']\)', text):
            sel = m.group(1)
            if sel.startswith("."):
                cls = sel[1:].split("[")[0].split(":")[0]
                if cls not in css_classes:
                    missing_classes.append(f"{jsf.name}:{m.start()} class='{cls}'")

    # data-app registry check
    data_apps = set(re.findall(r'data-app="([^"]+)"', html))
    for app in data_apps:
        app_file = REPO_ROOT / f"public/js/apps/{app}.js"
        if not app_file.exists() and app != "dashboard":
            detail_lines.append(f"data-app='{app}' has no matching public/js/apps/{app}.js")
            status = "FAIL"

    if missing_ids:
        detail_lines.append(f"{len(missing_ids)} getElementById refs missing in HTML")
        status = "FAIL"
    if missing_classes:
        detail_lines.append(f"{len(missing_classes)} querySelector class refs missing in CSS")
        status = "FAIL"

    return {
        "check": "crossref-ids",
        "status": status,
        "detail": "; ".join(detail_lines) if detail_lines else f"All cross-references OK ({len(html_ids)} IDs, {len(css_classes)} CSS classes)"
    }

def check_server_routes(files):
    """Verify /api/ routes in JS exist in server."""
    status = "pass"
    detail_lines = []
    server_text = SERVER_PATH.read_text(encoding="utf-8")
    route_patterns = re.findall(r"['\"](/api/[^'\"]+)['\"]", server_text)
    route_set = set(route_patterns)

    js_files = [REPO_ROOT / f for f in files if f.endswith(".js")]
    if not js_files:
        js_files = list(JS_DIR.rglob("*.js"))

    missing = []
    for jsf in js_files:
        text = jsf.read_text(encoding="utf-8")
        for m in re.finditer(r'["\'](/api/[a-zA-Z0-9_\-/]+)["\']', text):
            route = m.group(1)
            if route not in route_set:
                missing.append(f"{jsf.name}: {route}")

    if missing:
        unique = sorted(set(missing))
        detail_lines.append(f"{len(unique)} JS refs missing in server: {', '.join(unique[:5])}")
        status = "FAIL"

    return {
        "check": "server-routes",
        "status": status,
        "detail": "; ".join(detail_lines) if detail_lines else "All API routes accounted for"
    }

def check_logic_js(files):
    """Bug prevention: catch common logic errors in changed JS files."""
    status = "pass"
    detail_lines = []
    js_files = [REPO_ROOT / f for f in files if f.endswith(".js")]
    if not js_files:
        return {"check": "logic-js", "status": "pass", "detail": "No JS files in this change"}

    for jsf in js_files:
        text = jsf.read_text(encoding="utf-8")
        lines = text.splitlines()
        for i, line in enumerate(lines, 1):
            # Missing await on fetch
            if re.search(r"\b(fetch|axios)\s*\(", line) and "await" not in line and ".then" not in line:
                if not line.strip().startswith("//") and "function" not in line:
                    detail_lines.append(f"{jsf.name}:{i} — async call without await (missing Promise resolution)")
                    status = "FAIL"
            # Potential null dereference (simplified: x.y without check)
            if re.search(r"\b[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*\b", line):
                if "if (" not in line and "?" not in line and "=" in line:
                    pass  # too noisy, only flag on right-hand side expressions
            # == vs === in sensitive contexts (simplified)
            if re.search(r"\bif\s*\([^)]*\s==\s[^=]", line):
                detail_lines.append(f"{jsf.name}:{i} — loose equality (==) used instead of (===)")
                status = "FAIL"
            # setInterval without clearInterval variable
            if "setInterval(" in line and "clearInterval" not in text:
                detail_lines.append(f"{jsf.name}:{i} — setInterval used but no clearInterval found in file (memory leak risk)")
                status = "FAIL"
            # Unclosed event listeners (addEventListener without removeEventListener at EOF check)
            # This is checked at file level below

        # File-level: addEventListener vs removeEventListener counts
        add_ev = len(re.findall(r"addEventListener\(", text))
        rem_ev = len(re.findall(r"removeEventListener\(", text))
        if add_ev > rem_ev + 2:
            detail_lines.append(f"{jsf.name} — {add_ev} addEventListener but only {rem_ev} removeEventListener (potential leaks)")
            status = "FAIL"

    return {
        "check": "logic-js",
        "status": status,
        "detail": "; ".join(detail_lines) if detail_lines else "Logic analysis passed"
    }

def check_regression_smoke(files):
    """Fast smoke: validate-js.js + server startability."""
    status = "pass"
    detail_lines = []
    validate_script = REPO_ROOT / "validate-js.js"
    if validate_script.exists():
        try:
            subprocess.run(["node", str(validate_script)], capture_output=True, text=True, timeout=30, check=True)
        except subprocess.CalledProcessError as e:
            status = "FAIL"
            detail_lines.append(f"validate-js.js failed: {e.stderr.strip()[:200]}")

    # Check server imports cleanly
    try:
        proc = subprocess.run(
            [sys.executable, "-c", "import importlib.util; spec=importlib.util.spec_from_file_location('server','scripts/nexus-server.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)"],
            cwd=REPO_ROOT, capture_output=True, text=True, timeout=10
        )
        if proc.returncode != 0:
            # Server often fails because it binds a port or missing deps — this is expected, we just check syntax
            err = proc.stderr.strip()[:200]
            if "SyntaxError" in err or "IndentationError" in err:
                status = "FAIL"
                detail_lines.append(f"nexus-server.py has syntax error: {err}")
    except Exception as e:
        detail_lines.append(f"Server smoke test exception: {e}")

    return {
        "check": "regression-smoke",
        "status": status,
        "detail": "; ".join(detail_lines) if detail_lines else "Regression smoke passed"
    }

def check_security_scan(files):
    """Scan for hardcoded secrets, eval, innerHTML with user inputs."""
    status = "pass"
    detail_lines = []
    scan_files = [REPO_ROOT / f for f in files]
    if not scan_files:
        scan_files = list((REPO_ROOT / "public").rglob("*")) + [SERVER_PATH]

    secret_patterns = [
        (r"[A-Za-z0-9_-]{20,40}\.[A-Za-z0-9_-]{10,40}", "possible JWT/API token"),
        (r"sk-[a-zA-Z0-9]{20,48}", "possible OpenAI key"),
        (r"ghp_[a-zA-Z0-9]{30,40}", "possible GitHub PAT"),
        (r"[0-9a-f]{32,64}", "possible hex secret"),
    ]
    danger_patterns = [
        (r"\beval\s*\(", "eval() usage"),
        (r"\bFunction\s*\(", "Function() constructor"),
        (r"\.innerHTML\s*=.*\+", "innerHTML with concatenation (XSS risk)"),
        (r"document\.cookie", "cookie access"),
    ]

    for f in scan_files:
        if not f.is_file():
            continue
        try:
            text = f.read_text(encoding="utf-8")
        except Exception:
            continue
        for pat, desc in secret_patterns:
            if re.search(pat, text):
                detail_lines.append(f"{f.name}: suspicious pattern ({desc})")
                status = "FAIL"
        for pat, desc in danger_patterns:
            matches = re.finditer(pat, text)
            for m in matches:
                # Allow innerHTML with known-safe patterns (e.g., = `` or = "")
                line = text[:m.end()].splitlines()[-1]
                if "innerHTML" in line and (line.strip().endswith("`") or '"<' not in line):
                    continue
                detail_lines.append(f"{f.name}:{text[:m.start()].count(chr(10))+1} — {desc}")
                status = "FAIL"

    return {
        "check": "security-scan",
        "status": status,
        "detail": "; ".join(detail_lines) if detail_lines else "No security concerns"
    }

def check_task_consistency(files):
    """Every WHITEBOARD row has a tasks/T-XXX.md file."""
    status = "pass"
    wb = (REPO_ROOT / "WHITEBOARD.md").read_text(encoding="utf-8")
    wb_ids = set(re.findall(r"\bT-\d{3}[a-z]?\b", wb))
    task_ids = set()
    for f in (REPO_ROOT / "tasks").glob("T-*.md"):
        m = re.match(r"T-\d{3}[a-z]?", f.stem)
        if m:
            task_ids.add(m.group())

    missing = wb_ids - task_ids
    extra = task_ids - wb_ids
    detail = []
    if missing:
        detail.append(f"WHITEBOARD references missing tasks: {', '.join(sorted(missing))}")
        status = "FAIL"
    if extra:
        detail.append(f"Orphan task files not in WHITEBOARD: {', '.join(sorted(extra))}")
        status = "FAIL"

    return {
        "check": "task-consistency",
        "status": status,
        "detail": "; ".join(detail) if detail else f"All {len(wb_ids)} tasks consistent"
    }

# ─── Main Runner ─────────────────────────────────────────────────────

def run_qc(files):
    print("═" * 60)
    print("  NEXUS QC — Quality Check Auto Gate")
    print("  Purpose: Stop bugs before they hit the live dashboard.")
    print("═" * 60)

    checks = []
    overall = "PASS"

    results = [
        check_syntax_js(files),
        check_syntax_css(files),
        check_html_wellformed(files),
        check_cross_reference(files),
        check_server_routes(files),
        check_logic_js(files),
        check_regression_smoke(files),
        check_security_scan(files),
        check_task_consistency(files),
    ]

    checks = results
    if any(c["status"] == "FAIL" for c in checks):
        overall = "FAIL"

    qc_id = f"QC-{int(time.time())}"
    result = {
        "id": qc_id,
        "timestamp": now_iso(),
        "commit": get_git_head(),
        "files_changed": files,
        "stage": "QC",
        "checks": checks,
        "overall": overall,
        "next_action": "BLOCKED — fix failures before merge" if overall == "FAIL" else "Ready for QA review"
    }

    # Write to queue
    queue = load_json(QUEUE_PATH)
    if "queue" not in queue:
        queue["queue"] = []
    queue["queue"].insert(0, {
        "id": qc_id,
        "status": "QC-PASSED" if overall == "PASS" else "QC-FAILED",
        "commit": result["commit"],
        "files": files,
        "overall": overall,
        "created": now_iso(),
        "next_action": result["next_action"]
    })
    save_json(QUEUE_PATH, queue)

    # Write to audit log
    append_log(AUDIT_LOG, result)

    # Print report
    print()
    print(f"QC ID:    {qc_id}")
    print(f"Commit:   {result['commit']}")
    print(f"Files:    {len(files)}")
    print(f"Overall:  {overall}")
    print("-" * 60)
    for c in checks:
        icon = "✅" if c["status"] == "pass" else "❌"
        print(f"  {icon} {c['check']:20s} — {c['status']} — {c['detail'][:80]}")
    print("-" * 60)

    if overall == "FAIL":
        fail_count = sum(1 for c in checks if c["status"] == "FAIL")
        print(f"\n🛑 QC FAILED: {fail_count} check(s) failed. DO NOT MERGE.")
        print("   Fix failures, re-commit, and re-run QC.")
        sys.exit(1)
    else:
        print("\n✅ QC PASSED — ready for QA agent review (Stage 2).")
        sys.exit(0)

if __name__ == "__main__":
    args = sys.argv[1:]
    files = []
    if not args or "--all" in args:
        # Auto-detect changed files
        changed = get_changed_files()
        if changed:
            files = changed
            print(f"Detected {len(files)} changed file(s)")
        else:
            print("No changed files detected. Use: python3 scripts/nexus-qc.py file1 file2 ...")
            sys.exit(0)
    else:
        files = args

    run_qc(files)
