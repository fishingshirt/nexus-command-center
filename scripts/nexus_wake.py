#!/usr/bin/env python3
"""Nexus Command Center — Agent Wake Cycle Script.

Single entry-point for Hermes cron agent.
Reports status, not diagnostics.
"""

import subprocess, os, sys, re

REPO = "/home/fishingshirt/nexus-command-center"
os.chdir(REPO)

lines = ["🤖 Nexus Command Center — Wake Report"]
lines.append("")

# 1. Git pull
try:
    out = subprocess.run(["git", "pull"], capture_output=True, text=True, timeout=30)
    if out.stdout.strip():
        lines.append(f"Git pull: {out.stdout.strip()}")
    if out.stderr.strip() and "Already up to date" not in out.stdout:
        lines.append(f"Git stderr: {out.stderr.strip()}")
except Exception as e:
    lines.append(f"Git pull error: {e}")

lines.append("")

# 2. Git status
try:
    gs = subprocess.run(["git", "status", "--short"], capture_output=True, text=True, timeout=10)
    if gs.stdout.strip():
        lines.append("📦 Working tree has uncommitted changes:")
        lines.append(gs.stdout.strip())
        # Auto-commit any local changes
        subprocess.run(["git", "add", "."], timeout=10)
        subprocess.run(["git", "commit", "-m", "auto: nexus wake cycle"], timeout=10)
        push = subprocess.run(["git", "push"], capture_output=True, text=True, timeout=30)
        lines.append(f"Auto-pushed: {push.stdout.strip() or push.stderr.strip()}")
    else:
        lines.append("✅ Working tree clean")
except Exception as e:
    lines.append(f"Git status error: {e}")

lines.append("")

# 3. Read WHITEBOARD.md status
try:
    with open("WHITEBOARD.md") as f:
        wb = f.read()

    # Extract agent state
    m = re.search(r"Agent state:\s*([^\n]+)", wb)
    agent_state = m.group(1).strip() if m else "UNKNOWN"

    # Count statuses
    pending = len(re.findall(r"`PENDING`|\bPENDING\b", wb))
    inprog  = len(re.findall(r"`IN_PROGRESS`|\bIN_PROGRESS\b", wb))
    blocked = len(re.findall(r"`BLOCKED`|\bBLOCKED\b", wb))
    done    = len(re.findall(r"`DONE`|\bDONE\b", wb))

    lines.append("📊 WHITEBOARD Status:")
    lines.append(f"   Agent state: {agent_state}")
    lines.append(f"   PENDING:     {pending}")
    lines.append(f"   IN_PROGRESS: {inprog}")
    lines.append(f"   BLOCKED:     {blocked}")
    lines.append(f"   DONE:        {done}")

    if "PAUSED" in agent_state.upper():
        lines.append("")
        lines.append("⏸️ Agent is PAUSED. Waiting for user review.")
        lines.append("   To resume, remove PAUSED from WHITEBOARD.md or create a new PENDING task.")

except Exception as e:
    lines.append(f"WHITEBOARD read error: {e}")

lines.append("")
lines.append("✅ Wake cycle complete. Nothing to build until unpaused.")

print("\n".join(lines))
