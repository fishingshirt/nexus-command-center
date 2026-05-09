#!/usr/bin/env python3
"""nexus-backup.py  —  IT Hub Backup Engine
Handles archive creation, USB detection, encrypted cloud sync for Nexus.
"""
import os, sys, json, subprocess, time, glob, shutil

HOME = os.path.expanduser('~')
HERMES_DIR = os.path.join(HOME, '.hermes')
BACKUP_DIR = os.path.join(HOME, '.hermes', 'backups')
TEMP_DIR = os.path.join(HOME, '.hermes', 'tmp')

def ensure_dirs():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    os.makedirs(TEMP_DIR, exist_ok=True)

def _run(cmd, cwd=None, timeout=120, env=None, capture=True):
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, timeout=timeout,
                                capture_output=capture, text=True, env=env)
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, '', 'timeout'
    except Exception as e:
        return -1, '', str(e)

def _size_readable(path):
    try:
        size = os.path.getsize(path)
        for unit in ['B','KB','MB','GB','TB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} PB"
    except:
        return '?'

def find_usb_drives():
    drives = []
    rc, out, _ = _run("lsblk -J -o NAME,SIZE,TYPE,MOUNTPOINT,LABEL,FSTYPE,RM 2>/dev/null")
    if rc == 0:
        try:
            data = json.loads(out)
            for dev in data.get('blockdevices', []):
                children = dev.get('children', [])
                if not children and dev.get('mountpoint'):
                    children = [dev]
                for child in children:
                    mp = child.get('mountpoint') or ''
                    if mp and mp.startswith('/'):
                        drives.append({
                            'name': child.get('name', dev.get('name','unknown')),
                            'path': mp,
                            'label': child.get('label') or dev.get('label') or child.get('name'),
                            'size': child.get('size','?'),
                            'fstype': child.get('fstype') or dev.get('fstype','?'),
                            'mounted': True
                        })
                    elif child.get('children'):
                        for gchild in child.get('children',[]):
                            gmp = gchild.get('mountpoint') or ''
                            if gmp and gmp.startswith('/'):
                                drives.append({
                                    'name': gchild.get('name', child.get('name','unknown')),
                                    'path': gmp,
                                    'label': gchild.get('label') or child.get('label') or gchild.get('name'),
                                    'size': gchild.get('size','?'),
                                    'fstype': gchild.get('fstype') or child.get('fstype','?'),
                                    'mounted': True
                                })
        except:
            pass
    # fallback
    if not drives:
        for base in ['/media','/mnt','/run/media']:
            if not os.path.isdir(base): continue
            for user in os.listdir(base):
                up = os.path.join(base, user)
                if not os.path.isdir(up):
                    drives.append({'name': user, 'path': up, 'label': user, 'size': '?', 'fstype': '?', 'mounted': True})
                    continue
                for entry in os.listdir(up):
                    p = os.path.join(up, entry)
                    if os.path.ismount(p) or (os.path.isdir(p) and os.listdir(p)):
                        size = '?'
                        try:
                            st = os.statvfs(p)
                            size = f"{st.f_frsize * st.f_blocks/(1024**3):.1f} GB"
                        except: pass
                        drives.append({'name': entry, 'path': p, 'label': entry, 'size': size, 'fstype': '?', 'mounted': True})
    seen = set()
    uniq = []
    for d in drives:
        if d['path'] not in seen:
            seen.add(d['path'])
            uniq.append(d)
    return uniq

def has_gpg():
    rc,_,_ = _run("which gpg 2>/dev/null")
    return rc == 0

def gpg_encrypt(infile, outfile, passphrase):
    rc,out,err = _run(
        f"gpg --batch --yes --passphrase {shlex_quote(passphrase)} --symmetric --cipher-algo AES256 "
        f"--output {shlex_quote(outfile)} {shlex_quote(infile)}"
    )
    return rc, out, err

def create_backup_archive(encrypt_passphrase=None):
    ensure_dirs()
    ts = time.strftime('%Y%m%d_%H%M%S')
    name = f"nexus_backup_{ts}.tar.gz"
    archive = os.path.join(TEMP_DIR, name)
    hermes = os.path.abspath(HERMES_DIR)
    excludes = ["node_modules","__pycache__",".git/objects","tmp"]
    exclude_args = ' '.join(f"--exclude='{os.path.join(hermes,e)}'" for e in excludes)
    rc, out, err = _run(f"tar -czf {shlex_quote(archive)} -C {shlex_quote(HOME)} .hermes {exclude_args}")
    if rc != 0:
        raise RuntimeError(f"tar failed: {err}")
    if encrypt_passphrase and has_gpg():
        enc = archive + '.gpg'
        rc2,_,err2 = gpg_encrypt(archive, enc, encrypt_passphrase)
        if rc2 == 0:
            os.remove(archive)
            archive = enc
        else:
            raise RuntimeError(f"gpg failed: {err2}")
    return archive, _size_readable(archive)

def copy_to_usb(archive, usb_path):
    if not os.path.isdir(usb_path):
        return False, f"USB path not found: {usb_path}"
    dest = os.path.join(usb_path, os.path.basename(archive))
    try:
        shutil.copy2(archive, dest)
        return True, dest
    except Exception as e:
        return False, str(e)

def sync_to_cloud(archive, config):
    provider = config.get('provider','')
    remote = config.get('path','')
    if not provider or not remote:
        return False, "Cloud not configured"
    if provider == 'rclone':
        rc,out,err = _run(f"rclone copy {shlex_quote(archive)} {shlex_quote(remote)}", timeout=300)
        return rc == 0, err or out
    elif provider == 'rsync+ssh':
        rc,out,err = _run(f"rsync -avz --progress {shlex_quote(archive)} {shlex_quote(remote)}", timeout=300)
        return rc == 0, err or out
    elif provider == 's3':
        rc,_,_ = _run("which aws 2>/dev/null")
        if rc == 0:
            rc2,out2,err2 = _run(f"aws s3 cp {shlex_quote(archive)} {shlex_quote(remote)}", timeout=300)
            return rc2 == 0, err2 or out2
        rc,_,_ = _run("which s3cmd 2>/dev/null")
        if rc == 0:
            rc2,out2,err2 = _run(f"s3cmd put {shlex_quote(archive)} {shlex_quote(remote)}", timeout=300)
            return rc2 == 0, err2 or out2
        return False, "S3 tool not found"
    return False, f"Unknown provider: {provider}"

def run_backup(btype='full', target=None, config=None):
    cfg = config or {}
    passphrase = cfg.get('passphrase') if (cfg.get('provider') and btype != 'local') else None
    result = {'ok': False, 'type': btype, 'target': target or cfg.get('path','?'), 'size': '?', 'archive': None, 'error': None}
    if btype == 'cloud' and not cfg.get('provider'):
        result['error'] = "Cloud not configured"
        return result
    try:
        archive, size = create_backup_archive(encrypt_passphrase=passphrase)
        result['size'] = size
        result['archive'] = archive
        errors = []
        ok_local = True; ok_cloud = True
        if btype in ('full','local'):
            usb = target
            if not usb:
                drives = find_usb_drives()
                if drives: usb = drives[0]['path']
                else:
                    ok_local = False
                    errors.append("No USB found")
            if usb:
                ok_local, msg = copy_to_usb(archive, usb)
                if ok_local: result['target'] = usb
                else: errors.append(f"USB: {msg}")
        if btype in ('full','cloud'):
            if cfg.get('provider'):
                ok_cloud, msg = sync_to_cloud(archive, cfg)
                if not ok_cloud: errors.append(f"Cloud: {msg}")
            else:
                ok_cloud = False; errors.append("Cloud not configured")
        result['ok'] = (ok_local and ok_cloud) if btype=='full' else (ok_local if btype=='local' else ok_cloud)
        if not result['ok']:
            result['error'] = '; '.join(errors)
        if result['ok']:
            final = os.path.join(BACKUP_DIR, os.path.basename(archive))
            shutil.move(archive, final)
            result['archive'] = final
        else:
            # cap temp files
            try:
                temps = sorted(glob.glob(os.path.join(TEMP_DIR,'nexus_backup_*.tar.gz*')), key=os.path.getmtime)
                while len(temps) > 5:
                    os.remove(temps.pop(0))
            except: pass
    except Exception as e:
        result['error'] = str(e)
    return result

def shlex_quote(s):
    import shlex; return shlex.quote(s)

# ── Async job runner ──────────────────────────
import threading, uuid

_JOBS = {}
_JOB_LOCK = threading.Lock()

def run_backup_async(btype='full', target=None, config=None):
    job_id = str(uuid.uuid4())
    with _JOB_LOCK:
        _JOBS[job_id] = {'status': 'running', 'result': None, 'error': None}

    def worker():
        try:
            res = run_backup(btype=btype, target=target, config=config)
            with _JOB_LOCK:
                _JOBS[job_id] = {'status': 'done', 'result': res, 'error': None}
        except Exception as e:
            with _JOB_LOCK:
                _JOBS[job_id] = {'status': 'error', 'result': None, 'error': str(e)}
    threading.Thread(target=worker, daemon=True).start()
    return job_id

def get_job_status(job_id):
    with _JOB_LOCK:
        return _JOBS.get(job_id, {'status': 'unknown'})

if __name__ == '__main__':
    print(json.dumps(find_usb_drives(), indent=2))
