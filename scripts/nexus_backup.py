#!/usr/bin/env python3
"""Nexus Database Backup & Restore

Usage:
    python3 nexus-backup.py backup              # create a new DB backup
    python3 nexus-backup.py list                # list all DB backups
    python3 nexus-backup.py restore <file>      # restore from a .db backup
    python3 nexus-backup.py cleanup [--days N]  # delete backups older than N days (default 60)
    python3 nexus-backup.py auto                # backup + cleanup in one shot (for cron)

Backups are stored in ~/.hermes/backups/db/ with rotational cleanup.
"""
import os, sys, shutil, sqlite3, time, glob, json
from datetime import datetime, timedelta

# ── Configuration ──────────────────────────────────
NEXUS_REPO = os.path.expanduser('~/nexus-command-center')
DB_PATH = os.path.join(NEXUS_REPO, 'data', 'nexus.db')
BACKUP_DIR = os.path.expanduser('~/.hermes/backups/db')
DEFAULT_RETENTION_DAYS = 60

# ── Helpers ────────────────────────────────────────

def _ensure_dirs():
    os.makedirs(BACKUP_DIR, exist_ok=True)

def _timestamp():
    return datetime.now().strftime('%Y%m%d-%H%M%S')

def _fmt_size(path):
    try:
        b = os.path.getsize(path)
        if b < 1024: return f"{b} B"
        if b < 1024**2: return f"{b/1024:.1f} KB"
        if b < 1024**3: return f"{b/1024**2:.1f} MB"
        return f"{b/1024**3:.2f} GB"
    except Exception:
        return "?"

def _fmt_time(ts):
    try:
        d = datetime.fromtimestamp(ts)
        age = datetime.now() - d
        if age.days == 0:
            if age.seconds < 60: return "just now"
            if age.seconds < 3600: return f"{age.seconds//60}m ago"
            return f"{age.seconds//3600}h ago"
        if age.days == 1: return "yesterday"
        if age.days < 7: return f"{age.days}d ago"
        if age.days < 30: return f"{age.days//7}w ago"
        return d.strftime('%b %d, %Y')
    except Exception:
        return "?"

# ── Backup ─────────────────────────────────────────

def create_backup():
    _ensure_dirs()
    if not os.path.isfile(DB_PATH):
        print(f"[ERROR] Database not found: {DB_PATH}")
        sys.exit(1)

    stamp = _timestamp()
    filename = f"nexus-db-{stamp}.db"
    dest = os.path.join(BACKUP_DIR, filename)

    # Atomic copy via VACUUM INTO (SQLite-native, consistent snapshot)
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute(f"VACUUM INTO '{dest}'")
        conn.close()
    except Exception as e:
        print(f"[ERROR] VACUUM INTO failed: {e}")
        # Fallback: shutil copy (risk of WAL inconsistency but better than nothing)
        shutil.copy2(DB_PATH, dest)
        # Also copy WAL if present
        for suffix in ('-wal', '-shm'):
            wal = DB_PATH + suffix
            if os.path.isfile(wal):
                shutil.copy2(wal, dest + suffix)

    size = _fmt_size(dest)
    mtime = os.path.getmtime(dest)
    print(f"[OK] Backup created: {filename} ({size})")
    return {
        'filename': filename,
        'path': dest,
        'size': size,
        'bytes': os.path.getsize(dest),
        'created': datetime.fromtimestamp(mtime).isoformat(),
        'timestamp': mtime,
    }

# ── List ───────────────────────────────────────────

def list_backups():
    _ensure_dirs()
    files = []
    for fp in sorted(glob.glob(os.path.join(BACKUP_DIR, 'nexus-db-*.db')), reverse=True):
        st = os.stat(fp)
        files.append({
            'filename': os.path.basename(fp),
            'path': fp,
            'size': _fmt_size(fp),
            'bytes': st.st_size,
            'created': datetime.fromtimestamp(st.st_mtime).isoformat(),
            'timestamp': st.st_mtime,
            'age_str': _fmt_time(st.st_mtime),
        })
    return files

def print_backups():
    backups = list_backups()
    if not backups:
        print("[INFO] No database backups found.")
        return
    print(f"{'#':<4} {'Filename':<30} {'Size':<12} {'Age':<15}")
    print("-" * 65)
    for i, b in enumerate(backups, 1):
        print(f"{i:<4} {b['filename']:<30} {b['size']:<12} {b['age_str']:<15}")
    print(f"\n[INFO] {len(backups)} backup(s) in {BACKUP_DIR}")

# ── Cleanup ──────────────────────────────────────────

def cleanup(days=DEFAULT_RETENTION_DAYS):
    _ensure_dirs()
    cutoff = time.time() - (days * 86400)
    removed = 0
    total_bytes = 0
    for fp in glob.glob(os.path.join(BACKUP_DIR, 'nexus-db-*.db')):
        if os.path.getmtime(fp) < cutoff:
            try:
                b = os.path.getsize(fp)
                os.remove(fp)
                # Clean companion WAL/SHM if any
                for suffix in ('-wal', '-shm'):
                    w = fp + suffix
                    if os.path.isfile(w):
                        os.remove(w)
                removed += 1
                total_bytes += b
            except Exception as e:
                print(f"[WARN] Failed to remove {fp}: {e}")
    print(f"[OK] Cleanup: {removed} backup(s) older than {days} days removed ({_fmt_size_from_bytes(total_bytes)} freed)")
    return removed, total_bytes

def _fmt_size_from_bytes(b):
    if b < 1024: return f"{b} B"
    if b < 1024**2: return f"{b/1024:.1f} KB"
    if b < 1024**3: return f"{b/1024**2:.1f} MB"
    return f"{b/1024**3:.2f} GB"

# ── Restore ────────────────────────────────────────

def restore_backup(filename_or_index):
    _ensure_dirs()

    # Resolve input: index number or filename
    backups = list_backups()
    if not backups:
        print("[ERROR] No backups available to restore from.")
        sys.exit(1)

    target = None
    try:
        idx = int(filename_or_index) - 1
        if 0 <= idx < len(backups):
            target = backups[idx]['path']
    except ValueError:
        # Treat as filename
        if os.path.isfile(filename_or_index):
            target = filename_or_index
        else:
            fp = os.path.join(BACKUP_DIR, filename_or_index)
            if os.path.isfile(fp):
                target = fp

    if not target:
        print(f"[ERROR] Backup not found: {filename_or_index}")
        sys.exit(1)

    if not os.path.isfile(DB_PATH):
        print(f"[ERROR] Current database missing: {DB_PATH}")
        sys.exit(1)

    # Safety: backup current DB before overwriting
    safety_stamp = _timestamp()
    safety_path = os.path.join(BACKUP_DIR, f"nexus-db-pre-restore-{safety_stamp}.db")
    try:
        shutil.copy2(DB_PATH, safety_path)
        for suffix in ('-wal', '-shm'):
            w = DB_PATH + suffix
            if os.path.isfile(w):
                shutil.copy2(w, safety_path + suffix)
        print(f"[OK] Safety copy created: {os.path.basename(safety_path)}")
    except Exception as e:
        print(f"[WARN] Safety copy failed: {e}")

    # Overwrite current DB with backup
    try:
        # Stop any running server briefly? No — SQLite VACUUM INTO was atomic,
        # but for restore we should close any open connections. We'll just copy.
        shutil.copy2(target, DB_PATH)
        # Restore WAL/SHM if present in backup dir with same stem
        for suffix in ('-wal', '-shm'):
            w = target + suffix
            if os.path.isfile(w):
                shutil.copy2(w, DB_PATH + suffix)
            else:
                # Remove stale WAL/SHM from current DB
                cw = DB_PATH + suffix
                if os.path.isfile(cw):
                    os.remove(cw)
        print(f"[OK] Database restored from: {os.path.basename(target)}")
        print(f"[INFO] Restart the Nexus server to ensure clean state.")
    except Exception as e:
        print(f"[ERROR] Restore failed: {e}")
        sys.exit(1)

# ── Auto (cron-friendly) ───────────────────────────

def auto_backup():
    """Create backup then cleanup old ones. Silent unless error."""
    result = create_backup()
    removed, freed = cleanup(DEFAULT_RETENTION_DAYS)
    return {
        'backup': result,
        'cleanup': { 'removed': removed, 'freed_bytes': freed }
    }

# ── CLI ────────────────────────────────────────────

if __name__ == '__main__':
    args = sys.argv[1:]
    if not args or args[0] in ('-h', '--help', 'help'):
        print(__doc__)
        sys.exit(0)

    cmd = args[0]
    if cmd == 'backup':
        create_backup()
    elif cmd == 'list':
        print_backups()
    elif cmd == 'restore':
        if len(args) < 2:
            print("[ERROR] Usage: nexus-backup.py restore <filename_or_index>")
            sys.exit(1)
        restore_backup(args[1])
    elif cmd == 'cleanup':
        days = DEFAULT_RETENTION_DAYS
        if len(args) >= 3 and args[1] == '--days':
            try:
                days = int(args[2])
            except ValueError:
                pass
        cleanup(days)
    elif cmd == 'auto':
        auto_backup()
    else:
        print(f"[ERROR] Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)
