#!/usr/bin/env python3
"""Nexus System Backup & Restore

Usage:
    python3 nexus_backup.py backup [--scope SCOPE]     # create a scoped backup
    python3 nexus_backup.py list [--scope SCOPE]         # list backups
    python3 nexus_backup.py restore <file_or_index>     # restore from archive
    python3 nexus_backup.py cleanup [--days N]           # delete old backups
    python3 nexus_backup.py auto                         # full backup + cleanup (cron)

Scopes: database, docker, brain, assets, metadata, full
Archives: tar.gz with internal directory structure + manifest.json
"""
import os, sys, shutil, sqlite3, time, glob, json, tarfile, subprocess, hashlib
from datetime import datetime, timedelta

# ── Configuration ──────────────────────────────────
NEXUS_REPO = os.path.expanduser('~/nexus-command-center')
DB_PATH = os.path.join(NEXUS_REPO, 'data', 'nexus.db')
BACKUP_DIR = os.path.expanduser('~/.hermes/backups')
CONFIG_PATH = os.path.expanduser('~/.hermes/nexus-backup-config.json')
DEFAULT_RETENTION_DAYS = 60

DEFAULT_CONFIG = {
    'retention_days': 60,
    'enabled_scopes': ['database', 'docker', 'brain', 'metadata'],
    'encryption': {
        'enabled': False,
        'passphrase': '',
    },
    'auto_backup': {
        'enabled': False,
        'hour': 3,        # 3 AM
    },
    'cloud': {
        'provider': '',
        'path': '',
        'auto_sync': False,
    },
    'notifications': {
        'health_warn_days': 7,   # warn if no backup in N days
        'health_crit_days': 30,  # critical if no backup in N days
    },
}

def load_config():
    """Load backup config from disk, merging defaults for missing keys."""
    cfg = dict(DEFAULT_CONFIG)
    try:
        if os.path.isfile(CONFIG_PATH):
            with open(CONFIG_PATH, 'r') as f:
                saved = json.load(f)
            _deep_merge(cfg, saved)
    except Exception:
        pass
    return cfg

def save_config(cfg):
    """Persist backup config to disk."""
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, 'w') as f:
        json.dump(cfg, f, indent=2)

def _deep_merge(base, override):
    """Merge override dict into base dict recursively."""
    for k, v in override.items():
        if k in base and isinstance(base[k], dict) and isinstance(v, dict):
            _deep_merge(base[k], v)
        else:
            base[k] = v

SCOPES = {
    'database': {'label': 'SQLite Database', 'icon': '💾'},
    'docker':   {'label': 'Docker Config',   'icon': '🐳'},
    'brain':    {'label': 'Hermes Brain',    'icon': '🧠'},
    'assets':   {'label': 'Static Assets',   'icon': '🎨'},
    'metadata': {'label': 'Project Metadata','icon': '📋'},
    'full':     {'label': 'Everything',      'icon': '📦'},
}

# Files per scope ─────────────────────────────────
SCOPE_FILES = {
    'docker': [
        ('docker-compose.yml', 'docker/docker-compose.yml'),
        ('Dockerfile',         'docker/Dockerfile'),
        ('nginx.conf',         'docker/nginx.conf'),
        ('.gitignore',         'docker/.gitignore'),
    ],
    'brain': [
        ('~/.hermes/SOUL.md',                'brain/SOUL.md'),
        ('~/.hermes/config.yaml',            'brain/config.yaml'),
        ('~/.hermes/channel_directory.json', 'brain/channel_directory.json'),
        ('~/.hermes/auth.json',              'brain/auth.json'),
    ],
    'assets': [
        ('public/assets', 'assets/public/assets'),
        ('public/css',    'assets/public/css'),
    ],
    'metadata': [
        ('manifest.json',     'metadata/manifest.json'),
        ('PROJECT.md',        'metadata/PROJECT.md'),
        ('AGENTS.md',         'metadata/AGENTS.md'),
        ('AGENT_CONTEXT.md',  'metadata/AGENT_CONTEXT.md'),
        ('AGENT_GUIDELINES.md','metadata/AGENT_GUIDELINES.md'),
        ('README.md',         'metadata/README.md'),
        ('WHITEBOARD.md',     'metadata/WHITEBOARD.md'),
    ],
}

# ── Helpers ────────────────────────────────────────

def _ensure_dirs():
    os.makedirs(BACKUP_DIR, exist_ok=True)

def _timestamp():
    return datetime.now().strftime('%Y%m%d-%H%M%S')

def _fmt_size(b):
    if not isinstance(b, int): b = os.path.getsize(b)
    if b < 1024: return f"{b} B"
    if b < 1024**2: return f"{b/1024:.1f} KB"
    if b < 1024**3: return f"{b/1024**2:.1f} MB"
    return f"{b/1024**3:.2f} GB"

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

def _resolve_path(rel_or_home):
    if rel_or_home.startswith('~/'):
        return os.path.expanduser(rel_or_home)
    if rel_or_home.startswith('/'):
        return rel_or_home
    return os.path.join(NEXUS_REPO, rel_or_home)

def _git_info():
    def run(cmd):
        try:
            return subprocess.check_output(cmd, cwd=NEXUS_REPO, stderr=subprocess.DEVNULL, text=True).strip()
        except Exception:
            return ''
    return {
        'branch': run(['git', 'rev-parse', '--abbrev-ref', 'HEAD']),
        'commit': run(['git', 'log', '-1', '--format=%h']),
        'message': run(['git', 'log', '-1', '--format=%s']),
        'dirty': bool(run(['git', 'status', '--porcelain'])),
    }

# ── Backup ─────────────────────────────────────────

def create_backup(scope='full'):
    _ensure_dirs()
    stamp = _timestamp()
    filename = f"nexus-backup-{scope}-{stamp}.tar.gz"
    dest = os.path.join(BACKUP_DIR, filename)

    # Determine which scopes to include
    cfg = load_config()
    if scope == 'full':
        scopes = cfg.get('enabled_scopes', list(SCOPES.keys())[:-1])
    else:
        scopes = [scope]

    # Build manifest
    manifest = {
        'version': 2,
        'created': stamp,
        'scope': scope,
        'scopes': scopes,
        'hostname': os.uname().nodename,
        'git': _git_info(),
        'files': {},
    }

    # Collect files into a temp staging dir
    tmp_dir = os.path.join(BACKUP_DIR, f".staging-{stamp}-{os.urandom(2).hex()}")
    os.makedirs(tmp_dir, exist_ok=True)

    total_bytes = 0
    for s in scopes:
        for src_rel, dest_rel in SCOPE_FILES.get(s, []):
            src = _resolve_path(src_rel)
            if not os.path.exists(src):
                continue
            dst = os.path.join(tmp_dir, dest_rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                shutil.copy2(src, dst)
            b = os.path.getsize(dst) if os.path.isfile(dst) else _dir_size(dst)
            total_bytes += b
            manifest['files'][dest_rel] = {'source': src_rel, 'size': b}

    # Database special case: VACUUM INTO for atomic consistency
    if 'database' in scopes and os.path.isfile(DB_PATH):
        db_dest = os.path.join(tmp_dir, 'database', 'nexus.db')
        os.makedirs(os.path.dirname(db_dest), exist_ok=True)
        # Remove any pre-existing copy so VACUUM INTO has a clean target
        if os.path.isfile(db_dest):
            os.remove(db_dest)
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.execute(f"VACUUM INTO '{db_dest}'")
            conn.close()
            b = os.path.getsize(db_dest)
            total_bytes += b
            manifest['files']['database/nexus.db'] = {'source': 'data/nexus.db', 'size': b, 'method': 'vacuum'}
        except Exception as e:
            print(f"[WARN] VACUUM INTO failed: {e}, using shutil copy")
            shutil.copy2(DB_PATH, db_dest)
            b = os.path.getsize(db_dest)
            total_bytes += b
            manifest['files']['database/nexus.db'] = {'source': 'data/nexus.db', 'size': b, 'method': 'copy'}
        # WAL/SHM
        for suffix in ('-wal', '-shm'):
            wal_src = DB_PATH + suffix
            wal_dst = db_dest + suffix
            if os.path.isfile(wal_src):
                if os.path.isfile(wal_dst):
                    os.remove(wal_dst)
                shutil.copy2(wal_src, wal_dst)
                b = os.path.getsize(wal_dst)
                total_bytes += b
                manifest['files'][f'database/nexus.db{suffix}'] = {'source': f'data/nexus.db{suffix}', 'size': b}

    # Docker container info
    if 'docker' in scopes:
        container_info = {}
        try:
            lines = subprocess.check_output(['docker', 'ps', '--filter', 'name=nexus', '--format', '{{json .}}'],
                                            stderr=subprocess.DEVNULL, text=True, timeout=10).strip()
            if lines:
                container_info = json.loads(lines.splitlines()[0])
        except Exception:
            pass
        info_path = os.path.join(tmp_dir, 'docker', 'container-info.json')
        with open(info_path, 'w') as f:
            json.dump(container_info, f, indent=2)

    # Write manifest
    manifest['total_bytes'] = total_bytes
    manifest_path = os.path.join(tmp_dir, 'manifest.json')
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    # Create tar.gz
    with tarfile.open(dest, 'w:gz') as tar:
        for root, dirs, files in os.walk(tmp_dir):
            for file in files:
                fp = os.path.join(root, file)
                arcname = os.path.relpath(fp, tmp_dir)
                tar.add(fp, arcname=arcname)

    # Clean staging
    shutil.rmtree(tmp_dir)

    size = _fmt_size(dest)
    mtime = os.path.getmtime(dest)
    print(f"[OK] Backup created: {filename} ({size}) — scope: {scope}")
    return {
        'filename': filename,
        'path': dest,
        'size': size,
        'bytes': os.path.getsize(dest),
        'scope': scope,
        'created': datetime.fromtimestamp(mtime).isoformat(),
        'timestamp': mtime,
    }

def _dir_size(path):
    total = 0
    for root, _, files in os.walk(path):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except Exception:
                pass
    return total

# ── List ───────────────────────────────────────────

def list_backups(scope=None):
    _ensure_dirs()
    files = []
    pattern = os.path.join(BACKUP_DIR, f"nexus-backup-{'*' if scope is None else scope}-*.tar.gz")
    for fp in sorted(glob.glob(pattern), reverse=True):
        st = os.stat(fp)
        # Peek manifest for scope
        backup_scope = 'unknown'
        try:
            with tarfile.open(fp, 'r:gz') as tar:
                mf = tar.extractfile('manifest.json')
                if mf:
                    m = json.loads(mf.read().decode())
                    backup_scope = m.get('scope', 'unknown')
        except Exception:
            pass
        files.append({
            'filename': os.path.basename(fp),
            'path': fp,
            'size': _fmt_size(fp),
            'bytes': st.st_size,
            'scope': backup_scope,
            'created': datetime.fromtimestamp(st.st_mtime).isoformat(),
            'timestamp': st.st_mtime,
            'age_str': _fmt_time(st.st_mtime),
        })
    return files

def print_backups(scope=None):
    backups = list_backups(scope)
    if not backups:
        print(f"[INFO] No backups found{' for scope ' + scope if scope else ''}.")
        return
    print(f"{'#':<4} {'Scope':<10} {'Filename':<35} {'Size':<12} {'Age':<15}")
    print("-" * 80)
    for i, b in enumerate(backups, 1):
        print(f"{i:<4} {b['scope']:<10} {b['filename']:<35} {b['size']:<12} {b['age_str']:<15}")
    print(f"\n[INFO] {len(backups)} backup(s) in {BACKUP_DIR}")

# ── Cleanup ──────────────────────────────────────────

def cleanup(days=DEFAULT_RETENTION_DAYS, scope=None):
    _ensure_dirs()
    cutoff = time.time() - (days * 86400)
    pattern = os.path.join(BACKUP_DIR, f"nexus-backup-{'*' if scope is None else scope}-*.tar.gz")
    removed = 0
    total_bytes = 0
    for fp in glob.glob(pattern):
        if os.path.getmtime(fp) < cutoff:
            try:
                b = os.path.getsize(fp)
                os.remove(fp)
                removed += 1
                total_bytes += b
            except Exception as e:
                print(f"[WARN] Failed to remove {fp}: {e}")
    print(f"[OK] Cleanup: {removed} backup(s) older than {days} days removed ({_fmt_size(total_bytes)} freed)")
    return removed, total_bytes

# ── Restore ────────────────────────────────────────

def restore_backup(filename_or_index):
    _ensure_dirs()
    backups = list_backups()
    if not backups:
        print("[ERROR] No backups available.")
        sys.exit(1)

    # Resolve input
    target = None
    try:
        idx = int(filename_or_index) - 1
        if 0 <= idx < len(backups):
            target = backups[idx]['path']
    except ValueError:
        if os.path.isfile(filename_or_index):
            target = filename_or_index
        else:
            fp = os.path.join(BACKUP_DIR, filename_or_index)
            if os.path.isfile(fp):
                target = fp

    if not target:
        print(f"[ERROR] Backup not found: {filename_or_index}")
        sys.exit(1)

    # Extract manifest to understand scope
    manifest = {}
    try:
        with tarfile.open(target, 'r:gz') as tar:
            mf = tar.extractfile('manifest.json')
            if mf:
                manifest = json.loads(mf.read().decode())
    except Exception as e:
        print(f"[ERROR] Cannot read manifest: {e}")
        sys.exit(1)

    scopes = manifest.get('scopes', [])
    print(f"[INFO] Restoring backup: {os.path.basename(target)}")
    print(f"[INFO] Scope: {manifest.get('scope', 'unknown')} — includes: {', '.join(scopes)}")

    # Extract to temp staging
    tmp_dir = os.path.join(BACKUP_DIR, f".restore-staging-{int(time.time())}")
    os.makedirs(tmp_dir, exist_ok=True)
    with tarfile.open(target, 'r:gz') as tar:
        tar.extractall(tmp_dir)

    # ── Database restore (with safety copy) ──
    if 'database' in scopes:
        if not os.path.isfile(DB_PATH):
            print(f"[WARN] Current database missing: {DB_PATH}")
        else:
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

        db_src = os.path.join(tmp_dir, 'database', 'nexus.db')
        if os.path.isfile(db_src):
            try:
                shutil.copy2(db_src, DB_PATH)
                for suffix in ('-wal', '-shm'):
                    w = db_src + suffix
                    if os.path.isfile(w):
                        shutil.copy2(w, DB_PATH + suffix)
                    else:
                        cw = DB_PATH + suffix
                        if os.path.isfile(cw):
                            os.remove(cw)
                print(f"[OK] Database restored.")
            except Exception as e:
                print(f"[ERROR] Database restore failed: {e}")

    # ── Docker files ──
    if 'docker' in scopes:
        docker_src = os.path.join(tmp_dir, 'docker')
        if os.path.isdir(docker_src):
            for fn in os.listdir(docker_src):
                if fn == 'container-info.json':
                    continue  # metadata only
                src = os.path.join(docker_src, fn)
                dst = os.path.join(NEXUS_REPO, fn)
                try:
                    if os.path.isfile(src):
                        shutil.copy2(src, dst)
                        print(f"[OK] Docker config restored: {fn}")
                except Exception as e:
                    print(f"[WARN] Failed to restore {fn}: {e}")

    # ── Brain files ──
    if 'brain' in scopes:
        brain_src = os.path.join(tmp_dir, 'brain')
        if os.path.isdir(brain_src):
            for fn in os.listdir(brain_src):
                src = os.path.join(brain_src, fn)
                dst = os.path.expanduser(f'~/.hermes/{fn}')
                try:
                    shutil.copy2(src, dst)
                    print(f"[OK] Brain restored: {fn}")
                except Exception as e:
                    print(f"[WARN] Failed to restore {fn}: {e}")

    # ── Assets ──
    if 'assets' in scopes:
        assets_src = os.path.join(tmp_dir, 'assets', 'public')
        if os.path.isdir(assets_src):
            for sub in os.listdir(assets_src):
                src = os.path.join(assets_src, sub)
                dst = os.path.join(NEXUS_REPO, 'public', sub)
                try:
                    if os.path.isdir(src):
                        if os.path.exists(dst):
                            shutil.rmtree(dst)
                        shutil.copytree(src, dst)
                        print(f"[OK] Assets restored: public/{sub}")
                except Exception as e:
                    print(f"[WARN] Failed to restore public/{sub}: {e}")

    # ── Metadata ──
    if 'metadata' in scopes:
        meta_src = os.path.join(tmp_dir, 'metadata')
        if os.path.isdir(meta_src):
            for fn in os.listdir(meta_src):
                src = os.path.join(meta_src, fn)
                dst = os.path.join(NEXUS_REPO, fn)
                try:
                    shutil.copy2(src, dst)
                    print(f"[OK] Metadata restored: {fn}")
                except Exception as e:
                    print(f"[WARN] Failed to restore {fn}: {e}")

    # Clean staging
    shutil.rmtree(tmp_dir)
    print(f"[INFO] Restart the Nexus server to ensure clean state.")

# ── Auto (cron-friendly) ───────────────────────────

def auto_backup(scope='full'):
    cfg = load_config()
    result = create_backup(scope)
    retention = cfg.get('retention_days', DEFAULT_RETENTION_DAYS)
    removed, freed = cleanup(retention, scope=None)
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
    scope = 'full'
    # Parse --scope flag
    if '--scope' in args:
        idx = args.index('--scope')
        if idx + 1 < len(args):
            scope = args[idx + 1]
        args = [a for i, a in enumerate(args) if i not in (idx, idx + 1)]

    if cmd == 'backup':
        create_backup(scope)
    elif cmd == 'list':
        print_backups(scope if scope != 'full' else None)
    elif cmd == 'restore':
        if len(args) < 2:
            print("[ERROR] Usage: nexus_backup.py restore <file_or_index>")
            sys.exit(1)
        restore_backup(args[1])
    elif cmd == 'cleanup':
        days = DEFAULT_RETENTION_DAYS
        if '--days' in args:
            idx = args.index('--days')
            if idx + 1 < len(args):
                try:
                    days = int(args[idx + 1])
                except ValueError:
                    pass
        cleanup(days)
    elif cmd == 'auto':
        auto_backup(scope)
    else:
        print(f"[ERROR] Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)
