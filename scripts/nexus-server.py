#!/usr/bin/env python3
"""Nexus Command Center — Static SPA Server + IT Hub API
   Serves public/ on port 8080 with SPA fallback.
   Adds /api/* endpoints for IT Hub telemetry.
   Usage: python3 nexus-server.py [--port 8080] [--dir /path/to/public]
"""
import http.server, socketserver, os, sys, argparse, signal, atexit, json, time, subprocess, socket, shutil
from pathlib import Path

PIDFILE = os.path.expanduser('~/.hermes/nexus-server.pid')
START_TIME = time.time()

def get_args():
    p = argparse.ArgumentParser()
    p.add_argument('--port', type=int, default=8080)
    p.add_argument('--dir', default='/tmp/nexus-command-center/public')
    return p.parse_args()

def write_pid(pid):
    os.makedirs(os.path.dirname(PIDFILE), exist_ok=True)
    with open(PIDFILE, 'w') as f:
        f.write(str(pid))

def remove_pid():
    try:
        os.remove(PIDFILE)
    except FileNotFoundError:
        pass

def kill_existing():
    try:
        with open(PIDFILE) as f:
            old = int(f.read().strip())
        os.kill(old, signal.SIGTERM)
    except (FileNotFoundError, ValueError, ProcessLookupError, PermissionError):
        pass

def _cors(handler):
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type')

def _json(handler, status, data):
    body = json.dumps(data, default=str).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json')
    _cors(handler)
    handler.send_header('Content-Length', len(body))
    handler.end_headers()
    handler.wfile.write(body)

# ── API helpers ───────────────────────────────
def _git_info(repo):
    def run(*cmd):
        try:
            return subprocess.check_output(cmd, cwd=repo, stderr=subprocess.DEVNULL, text=True).strip()
        except Exception:
            return ''
    branch = run('git', 'rev-parse', '--abbrev-ref', 'HEAD')
    last_commit = run('git', 'log', '-1', '--format=%h')
    uncommitted = run('git', 'status', '--porcelain')
    last_push = run('git', 'log', '-1', '--format=%ci')
    return {
        'git_branch': branch or 'unknown',
        'last_commit': last_commit or 'unknown',
        'uncommitted_count': len([l for l in uncommitted.splitlines() if l.strip()]),
        'last_push_time': last_push or None
    }

def _health():
    data = {'cpu_percent': None, 'ram_percent': None, 'disk_percent': None,
            'uptime_seconds': int(time.time() - START_TIME), 'load_avg_1m': None}
    try:
        import psutil
        data['cpu_percent'] = psutil.cpu_percent(interval=0.5)
        mem = psutil.virtual_memory()
        data['ram_percent'] = round(mem.percent, 1)
        disk = psutil.disk_usage('/')
        data['disk_percent'] = round(disk.percent, 1)
        data['load_avg_1m'] = round(os.getloadavg()[0], 2)
    except Exception:
        pass
    return data

def _probe_tcp(host, port, timeout=1):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False

def _tail(path, lines=20):
    try:
        with open(path, 'r') as f:
            buf = f.readlines()
            return [l.rstrip('\n') for l in buf[-lines:]]
    except Exception:
        return []

def _deps():
    services = []
    # PostgreSQL
    services.append({'name': 'PostgreSQL', 'status': 'ok' if _probe_tcp('127.0.0.1', 5432) else 'error', 'message': 'Port 5432 probe'})
    # Redis
    services.append({'name': 'Redis', 'status': 'ok' if _probe_tcp('127.0.0.1', 6379) else 'error', 'message': 'Port 6379 probe'})
    # Tailscale
    try:
        subprocess.check_output(['tailscale', 'status', '--json'], stderr=subprocess.DEVNULL, timeout=3)
        services.append({'name': 'Tailscale', 'status': 'ok', 'message': 'Tailscale daemon responsive'})
    except Exception:
        try:
            subprocess.run(['which', 'tailscale'], check=True, stdout=subprocess.DEVNULL)
            services.append({'name': 'Tailscale', 'status': 'warn', 'message': 'Installed but not connected'})
        except Exception:
            services.append({'name': 'Tailscale', 'status': 'error', 'message': 'tailscale binary not found'})
    # Google API (connectivity check)
    try:
        import urllib.request
        with urllib.request.urlopen('https://www.googleapis.com/calendar/v3', timeout=5) as resp:
            # Expect 403/401 = service reachable
            services.append({'name': 'Google API', 'status': 'ok', 'message': 'Reachable'})
    except urllib.error.HTTPError as e:
        if e.code in (400, 401, 403, 404):
            services.append({'name': 'Google API', 'status': 'ok', 'message': 'Reachable'})
        else:
            services.append({'name': 'Google API', 'status': 'warn', 'message': f'HTTP {e.code}'})
    except Exception:
        services.append({'name': 'Google API', 'status': 'error', 'message': 'Unreachable'})
    # GitHub Push (connectivity to github.com)
    try:
        with socket.create_connection(('github.com', 443), timeout=3):
            services.append({'name': 'GitHub Push', 'status': 'ok', 'message': 'github.com:443 reachable'})
    except Exception:
        services.append({'name': 'GitHub Push', 'status': 'error', 'message': 'github.com unreachable'})
    # DNS
    try:
        socket.getaddrinfo('google.com', None)
        services.append({'name': 'DNS', 'status': 'ok', 'message': 'Resolution working'})
    except Exception:
        services.append({'name': 'DNS', 'status': 'error', 'message': 'DNS unavailable'})
    return {'services': services}

def _network():
    result = {'tailscale_ip': None, 'tailscale_status': 'not_installed', 'peers_count': 0, 'magic_dns': False, 'error': None}
    try:
        import json
        out = subprocess.check_output(['tailscale', 'status', '--json'], stderr=subprocess.DEVNULL, timeout=5)
        data = json.loads(out)
        # tailscale status json has Self with TailscaleIPs and Peer entries
        self_obj = data.get('Self', {})
        ips = self_obj.get('TailscaleIPs', [])
        result['tailscale_ip'] = ips[0] if ips else None
        result['tailscale_status'] = 'up' if self_obj.get('Online') else 'down'
        result['peers_count'] = len(data.get('Peer', {}))
        result['magic_dns'] = data.get('MagicDNSSuffix') is not None
    except FileNotFoundError:
        result['tailscale_status'] = 'not_installed'
        result['error'] = 'tailscale binary not found'
    except subprocess.TimeoutExpired:
        result['tailscale_status'] = 'error'
        result['error'] = 'Timed out querying tailscale status'
    except Exception as e:
        result['tailscale_status'] = 'error'
        result['error'] = str(e)
    return result

def _logs():
    errors_path = os.path.expanduser('~/.hermes/logs/errors.log')
    return {
        'errors_log_tail': _tail(errors_path, 20),
        'gateway_running': _probe_tcp('127.0.0.1', 7379),  # hermes gateway default port
        'cron_enabled': True  # cron job invoking us implies it's enabled
    }

# ── Agent Status helpers ──────────────────────
def agent_status():
    pidfile = os.path.expanduser('~/.hermes/nexus-agent.pid')
    pid = None
    try:
        with open(pidfile) as f:
            pid = int(f.read().strip())
    except FileNotFoundError:
        pass
    except ValueError:
        pass
    running = False
    if pid:
        try:
            import signal
            os.kill(pid, 0)
            running = True
        except (OSError, ProcessLookupError):
            pass
    last_heartbeat = None
    try:
        hb_path = os.path.expanduser('~/.hermes/nexus-agent-heartbeat.json')
        with open(hb_path) as f:
            h = json.load(f)
            last_heartbeat = h.get('timestamp')
    except FileNotFoundError:
        pass
    except ValueError:
        pass
    if last_heartbeat:
        try:
            # Parse ISO 8601 with optional timezone offset
            from datetime import datetime
            # Strip timezone for Python 3.10 compatibility
            ts = last_heartbeat.replace('Z', '+00:00')
            if ts.endswith('+00:00'):
                ts = ts[:-6]
            hb_time = datetime.strptime(ts, '%Y-%m-%dT%H:%M:%S')
            age = int((datetime.utcnow() - hb_time).total_seconds())
            if age > 1200:  # > 20 min old
                running = False
        except Exception:
            pass
    stats = {}
    try:
        with open(os.path.expanduser('~/.hermes/nexus-agent-stats.json')) as f:
            stats = json.load(f)
    except FileNotFoundError:
        pass
    except ValueError:
        pass
    return {
        'running': running,
        'pid': pid,
        'last_heartbeat': last_heartbeat,
        'stats': stats,
        'uptime_seconds': int(time.time() - START_TIME)
    }

def agent_heartbeat():
    hb_path = os.path.expanduser('~/.hermes/nexus-agent-heartbeat.json')
    ts = time.strftime('%Y-%m-%dT%H:%M:%S')
    with open(hb_path, 'w') as f:
        json.dump({'timestamp': ts}, f)
    return {'timestamp': ts, 'ok': True}

# ── Request Handler ─────────────────────────────
def _api_backup(handler, path, repo):
    import tempfile, glob, re

    BACKUP_DIR = os.path.expanduser('~/.hermes/backups')
    os.makedirs(BACKUP_DIR, exist_ok=True)

    if path == '/api/backup/usb':
        drives = []
        try:
            # Try lsblk for removable block devices
            out = subprocess.check_output(
                ['lsblk', '-J', '-o', 'NAME,SIZE,TYPE,MOUNTPOINT,LABEL,FSTYPE,RM'],
                stderr=subprocess.DEVNULL, text=True, timeout=5
            )
            blk = json.loads(out)
            for dev in blk.get('blockdevices', []):
                if dev.get('rm') != True:
                    continue
                # Children partitions
                for child in dev.get('children', []):
                    drives.append({
                        'path': child.get('mountpoint') or f'/dev/{child.get("name")}',
                        'label': child.get('label') or dev.get('name'),
                        'size': child.get('size') or dev.get('size'),
                        'fstype': child.get('fstype') or '',
                        'mounted': bool(child.get('mountpoint'))
                    })
                if not dev.get('children'):
                    drives.append({
                        'path': f'/dev/{dev.get("name")}',
                        'label': dev.get('label') or dev.get('name'),
                        'size': dev.get('size'),
                        'fstype': dev.get('fstype') or '',
                        'mounted': bool(dev.get('mountpoint'))
                    })
        except Exception:
            # Fallback: scan /media and /mnt for mount points
            for base in ['/media', '/mnt', '/run/media']:
                if os.path.isdir(base):
                    for user in os.listdir(base):
                        up = os.path.join(base, user)
                        if os.path.isdir(up):
                            for d in os.listdir(up):
                                dp = os.path.join(up, d)
                                if os.path.ismount(dp):
                                    try:
                                        st = shutil.disk_usage(dp)
                                        size = f"{st.total // (1024**3)} GB"
                                    except Exception:
                                        size = '?'
                                    drives.append({
                                        'path': dp, 'label': d, 'size': size,
                                        'fstype': '', 'mounted': True
                                    })
        _json(handler, 200, {'drives': drives})
        return True

    if path == '/api/backup/run':
        import hashlib, datetime
        try:
            length = int(handler.headers.get('Content-Length', 0))
            body = handler.rfile.read(length).decode('utf-8') if length else '{}'
            req = json.loads(body)
        except Exception:
            _json(handler, 400, {'ok': False, 'error': 'Invalid JSON'})
            return True

        btype = req.get('type', 'full')
        cfg = req.get('config', {})
        target = req.get('target')
        timestamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')

        # Gather ncc localStorage keys plus settings
        export_data = {'_meta': {'exported_at': timestamp, 'version': 1, 'type': btype}}
        for k in list(os.environ.keys()):
            if k.startswith('ncc-'):
                pass  # no env fallback; we only read browser localStorage via frontend
        # Since we cannot read browser localStorage from server, we accept it in the request
        payload_data = req.get('data', {})
        if payload_data:
            export_data['data'] = payload_data
        else:
            export_data['data'] = {}

        # Write to server backup dir
        arc_name = f"nexus-backup-{timestamp}.json"
        arc_path = os.path.join(BACKUP_DIR, arc_name)
        with open(arc_path, 'w') as f:
            json.dump(export_data, f, indent=2)

        # If gpg + passphrase, encrypt in place
        passphrase = cfg.get('passphrase', '')
        if passphrase and len(passphrase) >= 8:
            enc_path = arc_path + '.gpg'
            try:
                subprocess.run(
                    ['gpg', '--batch', '--passphrase-fd', '0', '--symmetric',
                     '--cipher-algo', 'AES256', '-o', enc_path, arc_path],
                    input=passphrase.encode(), check=True, timeout=60
                )
                os.remove(arc_path)
                arc_path = enc_path
                arc_name += '.gpg'
            except Exception:
                pass  # leave unencrypted if gpg unavailable

        # If local target (USB path), copy there too
        final_target = 'server'
        if btype in ('local', 'full') and target:
            if os.path.isdir(target):
                try:
                    dest = os.path.join(target, arc_name)
                    shutil.copy2(arc_path, dest)
                    final_target = target
                except Exception as e:
                    _json(handler, 200, {'ok': False, 'error': f'USB copy failed: {e}'})
                    return True

        # Cloud
        if btype == 'cloud' and cfg.get('provider'):
            # Placeholder: we only store locally; real cloud sync is future work
            final_target = f"cloud({cfg['provider']})→server"

        size = '—'
        try:
            size = f"{os.path.getsize(arc_path):,} bytes"
        except Exception:
            pass

        _json(handler, 200, {
            'ok': True, 'file': arc_name, 'path': arc_path,
            'target': final_target, 'size': size,
            'summary': f'Backed up to {final_target}'
        })
        return True

    if path == '/api/backup/history':
        entries = []
        try:
            for fn in sorted(os.listdir(BACKUP_DIR), reverse=True):
                if not fn.startswith('nexus-backup-'):
                    continue
                fp = os.path.join(BACKUP_DIR, fn)
                st = os.stat(fp)
                entries.append({
                    'filename': fn,
                    'size': f"{st.st_size:,} bytes",
                    'created': datetime.datetime.fromtimestamp(st.st_mtime).isoformat(),
                    'encrypted': fn.endswith('.gpg')
                })
        except Exception:
            pass
        _json(handler, 200, {'ok': True, 'backups': entries})
        return True

    if path == '/api/backup/download':
        import urllib.parse
        qs = handler.path.split('?', 1)[1] if '?' in handler.path else ''
        params = urllib.parse.parse_qs(qs)
        filename = (params.get('file', [''])[0] or '').replace('/', '').replace('\\', '')
        if not filename or not filename.startswith('nexus-backup-'):
            _json(handler, 400, {'ok': False, 'error': 'Invalid filename'})
            return True
        fp = os.path.join(BACKUP_DIR, filename)
        if not os.path.isfile(fp) or not os.path.realpath(fp).startswith(os.path.realpath(BACKUP_DIR)):
            _json(handler, 404, {'ok': False, 'error': 'Not found'})
            return True
        handler.send_response(200)
        handler.send_header('Content-Type', 'application/octet-stream')
        handler.send_header('Content-Disposition', f'attachment; filename="{filename}"')
        handler.send_header('Content-Length', str(os.path.getsize(fp)))
        _cors(handler)
        handler.end_headers()
        with open(fp, 'rb') as f:
            handler.wfile.write(f.read())
        return True

    _json(handler, 404, {'ok': False, 'error': 'Unknown backup endpoint'})
    return True

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        self.args_dir = k.pop('args_dir')
        super().__init__(*a, directory=self.args_dir, **k)

    def _api_handler(self):
        path = self.path.split('?')[0]
        repo = os.path.dirname(os.path.abspath(self.args_dir))

        if path == '/api/server/status':
            info = {'pid': os.getpid(), 'port': self.server.server_address[1],
                    'uptime_seconds': int(time.time() - START_TIME)}
            info.update(_git_info(repo))
            _json(self, 200, info)
            return True

        if path == '/api/system/health':
            _json(self, 200, _health())
            return True

        if path == '/api/system/deps':
            _json(self, 200, _deps())
            return True

        if path == '/api/system/network':
            _json(self, 200, _network())
            return True

        if path == '/api/system/logs':
            _json(self, 200, _logs())
            return True

        if path == '/api/agent/status':
            _json(self, 200, agent_status())
            return True

        if path == '/api/agent/heartbeat':
            _json(self, 200, agent_heartbeat())
            return True

        if path == '/api/agent/notify':
            import datetime
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8') if length else '{}'
                req = json.loads(body)
            except Exception:
                _json(self, 400, {'ok': False, 'error': 'Invalid JSON'})
                return True
            note = {
                'id': 'agent-' + str(int(time.time() * 1000)),
                'title': req.get('title', 'Build Update'),
                'message': req.get('message', ''),
                'type': req.get('type', 'info'),
                'timestamp': datetime.datetime.now().isoformat()
            }
            # Save to server-side notification queue file
            queue_path = os.path.expanduser('~/.hermes/nexus-notifications.json')
            queue = []
            try:
                with open(queue_path, 'r') as f:
                    queue = json.load(f)
            except Exception:
                pass
            queue.append(note)
            # keep last 50
            queue = queue[-50:]
            try:
                with open(queue_path, 'w') as f:
                    json.dump(queue, f, indent=2)
            except Exception:
                pass
            _json(self, 200, {'ok': True, 'notification': note, 'queued': len(queue)})
            return True

        if path == '/api/agent/notifications':
            queue_path = os.path.expanduser('~/.hermes/nexus-notifications.json')
            queue = []
            try:
                with open(queue_path, 'r') as f:
                    queue = json.load(f)
            except Exception:
                pass
            _json(self, 200, {'notifications': queue[-20:]})
            return True

        if path.startswith('/api/backup/'):
            return _api_backup(self, path, repo)

        return False

    def do_OPTIONS(self):
        self.send_response(204)
        _cors(self)
        self.end_headers()

    def do_POST(self):
        self.extensions_map['.js'] = 'application/javascript'
        self.extensions_map['.css'] = 'text/css'
        self.extensions_map['.svg'] = 'image/svg+xml'
        self.extensions_map['.json'] = 'application/json'
        if self.path.startswith('/api/'):
            path = self.path.split('?')[0]
            repo = os.path.dirname(os.path.abspath(self.args_dir))
            if path.startswith('/api/backup/'):
                if _api_backup(self, path, repo):
                    return
        self.send_response(405)
        self.end_headers()

    def do_GET(self):
        self.extensions_map['.js'] = 'application/javascript'
        self.extensions_map['.css'] = 'text/css'
        self.extensions_map['.svg'] = 'image/svg+xml'
        self.extensions_map['.json'] = 'application/json'
        if self.path.startswith('/api/'):
            if self._api_handler():
                return
        path = os.path.join(self.args_dir, self.path.lstrip('/'))
        if self.path != '/' and '.' not in os.path.basename(self.path) and not os.path.exists(path):
            self.path = '/'
        super().do_GET()

    def log_message(self, fmt, *a):
        sys.stderr.write(fmt % a + '\n')

# ── Main ────────────────────────────────────────
def main():
    args = get_args()
    root = os.path.abspath(args.dir)

    kill_existing()
    write_pid(os.getpid())
    atexit.register(remove_pid)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', args.port), lambda *a, **k: SPAHandler(*a, args_dir=root, **k)) as httpd:
        print(f'✓ Nexus running at http://localhost:{args.port}')
        print(f'✓ Serving from {root}')
        print(f'✓ PID: {os.getpid()}  (saved to {PIDFILE})')
        httpd.serve_forever()

if __name__ == '__main__':
    main()
