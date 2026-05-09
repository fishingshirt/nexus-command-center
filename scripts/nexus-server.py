#!/usr/bin/env python3
"""Nexus Command Center — Static SPA Server + IT Hub API
   Serves public/ on port 8080 with SPA fallback.
   Adds /api/* endpoints for IT Hub telemetry.
   Usage: python3 nexus-server.py [--port 8080] [--dir /path/to/public]
"""
import http.server, socketserver, os, sys, argparse, signal, atexit, json, time, subprocess, socket
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

# ── Request Handler ─────────────────────────────
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

        if path.startswith('/api/backup/'):
            # pass through to static handler — backup endpoints could be added later
            _json(self, 501, {'ok': False, 'error': 'Not implemented in this server'})
            return True

        return False

    def do_OPTIONS(self):
        self.send_response(204)
        _cors(self)
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
